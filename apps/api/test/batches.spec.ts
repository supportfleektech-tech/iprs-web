import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { VerificationType } from '@fleek/types';
import { BatchesService } from '../src/verifications/batches.service';
import { InsufficientFundsException } from '../src/common/exceptions';
import { parseCsv, csvRowsToInputs } from '../src/verifications/bulk.dto';

function makeDeps() {
  const client = {
    verificationBatch: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'batch1',
          status: 'processing',
          createdAt: new Date(),
          completedAt: null,
          errorMessage: null,
          processedRows: 0,
          successCount: 0,
          failedCount: 0,
          notFoundCount: 0,
          ...data,
        }),
      ),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    verificationRequest: { findMany: vi.fn().mockResolvedValue([]) },
    productPricing: { findUnique: vi.fn() },
    wallet: { findUnique: vi.fn() },
  };
  const prisma = { client, encrypt: (v: string) => v, decrypt: (v: string) => v } as never;
  const run = vi.fn();
  const isEnabled = vi.fn().mockReturnValue(true);
  const verifications = {
    registry: { isEnabled },
    run,
  } as never;
  return { service: new BatchesService(prisma, verifications), client, run, isEnabled };
}

/** Lets fire-and-forget background processing settle before assertions. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setImmediate(r));
  }
}

const baseDto = {
  type: VerificationType.IPRS_ID,
  consentCollectedBy: 'Acme Ltd',
};

describe('BatchesService.createBatch', () => {
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    deps = makeDeps();
    deps.client.productPricing.findUnique.mockResolvedValue({ active: true, priceMinor: BigInt(5000) });
    deps.client.wallet.findUnique.mockResolvedValue({ balanceMinor: BigInt(10_000_000) });
  });

  it('rejects empty batches', async () => {
    await expect(deps.service.createBatch('org1', 'u1', { ...baseDto, rows: [] })).rejects.toThrow(
      /No usable rows/,
    );
  });

  it('rejects more than 1000 rows', async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({ idNumber: `${i + 1}` }));
    await expect(deps.service.createBatch('org1', 'u1', { ...baseDto, rows })).rejects.toThrow(
      /at most 1000/,
    );
  });

  it('refuses to start when the wallet cannot cover the estimate', async () => {
    deps.client.wallet.findUnique.mockResolvedValue({ balanceMinor: BigInt(100_000) }); // KES 1,000
    const rows = [{ idNumber: '12345678' }, { idNumber: '87654321' }]; // KES 100 total — ok
    // Make cost exceed balance:
    deps.client.wallet.findUnique.mockResolvedValue({ balanceMinor: BigInt(5_000) }); // KES 50
    await expect(deps.service.createBatch('org1', 'u1', { ...baseDto, rows })).rejects.toThrow(
      InsufficientFundsException,
    );
  });

  it('processes rows through the single-verification pipeline and records counters', async () => {
    deps.run
      .mockResolvedValueOnce({ status: 'success' })
      .mockResolvedValueOnce({ status: 'not_found' })
      .mockRejectedValueOnce(new Error('upstream boom'));

    const rows = [{ idNumber: '11111111' }, { idNumber: '22222222' }, { idNumber: '33333333' }];
    const summary = await deps.service.createBatch('org1', 'u1', { ...baseDto, rows });
    expect(summary.id).toBe('batch1');
    expect(summary.status).toBe('processing');

    await settle();

    expect(deps.run).toHaveBeenCalledTimes(3);
    // Every row was submitted with consent captured
    expect(deps.run.mock.calls[0]![1]).toMatchObject({
      consent: true,
      type: VerificationType.IPRS_ID,
      consentCollectedBy: 'Acme Ltd',
    });

    const finalUpdate = deps.client.verificationBatch.update.mock.calls.at(-1)![0];
    expect(finalUpdate.data).toMatchObject({
      status: 'completed',
      successCount: 1,
      notFoundCount: 1,
      failedCount: 1,
      processedRows: 3,
    });
    expect(finalUpdate.data.completedAt).toBeInstanceOf(Date);
  });

  it('aborts mid-batch when credit runs out', async () => {
    deps.run.mockRejectedValueOnce(new InsufficientFundsException());
    deps.run.mockRejectedValue(new InsufficientFundsException());

    const rows = Array.from({ length: 50 }, (_, i) => ({ idNumber: `${10000000 + i}` }));
    await deps.service.createBatch('org1', 'u1', { ...baseDto, rows });

    await settle();

    const finalUpdate = deps.client.verificationBatch.update.mock.calls.at(-1)![0];
    expect(finalUpdate.data.status).toBe('failed');
    expect(finalUpdate.data.errorMessage).toMatch(/credit/i);
    // Aborted well before all 50 rows
    expect(deps.run.mock.calls.length).toBeLessThan(50);
  });

  it('disables checks that are not enabled', async () => {
    const svcDeps = makeDeps();
    svcDeps.isEnabled.mockReturnValue(false);
    await expect(
      svcDeps.service.createBatch('org1', 'u1', { ...baseDto, rows: [{ idNumber: '123' }] }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('CSV parsing helpers', () => {
  it('parses quoted CSV with headers', () => {
    const csv = 'id_number,full_name\n"12345678","Kamau, John"\n87654321,Jane\n';
    const records = parseCsv(csv);
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ id_number: '12345678', full_name: 'Kamau, John' });
  });

  it('maps known header aliases to inputs', () => {
    const rows = csvRowsToInputs([
      { ID_NUMBER: '12345678', name: 'x' },
      { Phone: '0712345678' },
      { kra_pin: 'A012345678Z' },
      {},
    ]);
    expect(rows[0]).toEqual({ idNumber: '12345678' });
    expect(rows[1]).toEqual({ phoneNumber: '0712345678' });
    expect(rows[2]).toEqual({ kraPin: 'A012345678Z' });
    expect(rows[3]).toEqual({});
  });
});
