import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VerificationsService } from '../src/verifications/verifications.service';
import { VerificationType } from '@fleek/types';
import { ProviderError } from '@fleek/providers';

const FAKE_IPRS_RESULT = {
  idNumber: '12345678',
  surname: 'Test',
  firstName: 'Case',
  fullName: 'Test Case',
  gender: 'M',
  dateOfBirth: '1990-01-01',
  citizenship: 'Kenyan',
  serialNumber: 'SN1',
};

const baseDto = {
  type: VerificationType.IPRS_STANDARD,
  idNumber: '12345678',
  consent: true,
  consentCollectedBy: 'test',
};

/**
 * Billing atomicity: the tier charged must reflect the volume locked inside
 * the wallet transaction — not a stale read taken before the provider call.
 * Concurrent runs crossing a tier boundary must not all bill the lower tier,
 * and a wallet drained between check and debit must not go negative.
 */
describe('billing atomicity', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let client: any;
  let service: VerificationsService;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sqlOf = (q: any): string => (Array.isArray(q) ? q.join('?') : String(q));
    client = {
      productPricing: {
        findMany: vi.fn().mockResolvedValue([
          { type: 'iprs_standard', priceMinor: 3000n, active: true },
        ]),
        findUnique: vi.fn().mockResolvedValue({
          type: 'iprs_standard',
          priceMinor: 3000n,
          active: true,
        }),
      },
      // Tier lookup answers by requested volume: 0 → KES 30, ≥501 → KES 28.
      productPricingTier: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findFirst: vi.fn(async (args: any) => {
          const vol = args?.where?.minVolume?.lte ?? 0;
          return vol >= 501
            ? { minVolume: 501, maxVolume: 2500, unitPriceMinor: 2800n, backupPriceMinor: 4300n, vatExclusive: true }
            : { minVolume: 0, maxVolume: 500, unitPriceMinor: 3000n, backupPriceMinor: 4500n, vatExclusive: true };
        }),
      },
      organizationMonthlyUsage: {
        // Stale pre-read: no usage yet (volume 0).
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      orgEnabledChecks: { findMany: vi.fn().mockResolvedValue([]) },
      orgPricingTier: { findMany: vi.fn().mockResolvedValue([]) },
      wallet: {
        findUnique: vi.fn().mockResolvedValue({ id: 'w1', balanceMinor: 1_000_000n }),
        update: vi.fn().mockResolvedValue({ id: 'w1', balanceMinor: 997_200n }),
      },
      transaction: { create: vi.fn().mockResolvedValue({}) },
      verificationRequest: { create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: 'vr1',
        createdAt: new Date(),
        ...args.data,
      })) },
      // Locked reads inside the transaction: volume already at 600,
      // wallet holds KES 10,000.00.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $queryRaw: vi.fn(async (q: any) => {
        const s = sqlOf(q);
        if (s.includes('organization_monthly_usage')) return [{ volume: 600 }];
        if (s.includes('wallets')) return [{ id: 'w1', balanceMinor: 1_000_000n }];
        throw new Error(`unexpected query: ${s}`);
      }),
    };
    client.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(client));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockPrisma: any = { client, encrypt: (v: string) => v, decrypt: (v: string) => v };
    service = new VerificationsService(mockPrisma as never);
    (service as unknown as { registry: unknown }).registry = {
      isEnabled: () => true,
      hasBackup: () => false,
      isLive: () => false,
      resolve: () => ({ iprsStandardLookup: async () => FAKE_IPRS_RESULT }),
    };
  });

  it('charges the tier matching the locked volume, not the stale pre-read', async () => {
    const res = await service.run('org1', { ...baseDto }, 'dashboard');
    expect(res.status).toBe('success');
    // Locked volume 600 → 501–2500 band → KES 28 (stale vol 0 would bill 30).
    expect(res.cost).toBe(28);
  });

  it('records primary (not backup) when backup is requested but unconfigured', async () => {
    const res = await service.run(
      'org1',
      { ...baseDto, useBackup: true } as typeof baseDto & { useBackup: boolean },
      'dashboard',
    );
    expect(res.status).toBe('success');
    expect(res.isBackup).toBe(false);
    // Locked volume 600 → primary band price, not a backup markup.
    expect(res.cost).toBe(28);
  });

  it('does not offer a backup retry when the backup price is unknown', async () => {
    (service as unknown as { registry: unknown }).registry = {
      isEnabled: () => true,
      hasBackup: () => true,
      isLive: () => false,
      resolve: () => {
        throw new ProviderError('UPSTREAM_DOWN', 'primary down');
      },
    };
    // Tier carries no backup price — offering "retry with backup" would be
    // a blank cheque.
    client.productPricingTier.findFirst.mockResolvedValue({
      minVolume: 0,
      maxVolume: 500,
      unitPriceMinor: 3000n,
      backupPriceMinor: null,
      vatExclusive: true,
    });
    const res = await service.run('org1', { ...baseDto }, 'dashboard');
    expect(res.status).toBe('failed');
    expect(res.backupAvailable).toBe(false);
    expect(res.backupPrice).toBeUndefined();
  });

  it('products() hides the backup price when no backup is routed', async () => {
    client.productPricingTier.findFirst.mockResolvedValue({
      minVolume: 0,
      maxVolume: 500,
      unitPriceMinor: 3000n,
      backupPriceMinor: 4500n,
      vatExclusive: true,
    });
    const list = await service.products('org1');
    const entry = list.find((p) => p.type === 'iprs_standard');
    // Tier has a backup price but the registry routes no backup: the price
    // must not be advertised.
    expect(entry?.backupAvailable).toBe(false);
    expect(entry?.backupPriceKes).toBeNull();
  });

  it('prices scanned statements as KES 120 + KES 4 per page', async () => {
    (service as unknown as { registry: unknown }).registry = {
      isEnabled: () => true,
      hasBackup: () => false,
      isLive: () => false,
      resolve: () => ({ scannedStatementAnalysis: async () => ({ pages: 6 }) }),
    };
    const res = await service.run(
      'org1',
      {
        type: VerificationType.SCANNED_STATEMENT,
        statementPages: 6,
        consent: true,
        consentCollectedBy: 'test',
      },
      'dashboard',
    );
    expect(res.status).toBe('success');
    // 120 + 6×4 = KES 144 (the flat KES 120 tier row is the base, not the total).
    expect(res.cost).toBe(144);
  });

  it('refuses when the locked wallet balance is insufficient', async () => {
    client.$queryRaw.mockImplementation(async (q: unknown) => {
      const s = Array.isArray(q) ? (q as string[]).join('?') : String(q);
      if (typeof s === 'string' && s.includes('organization_monthly_usage'))
        return [{ volume: 0 }];
      if (typeof s === 'string' && s.includes('wallets'))
        return [{ id: 'w1', balanceMinor: 10n }];
      throw new Error(`unexpected query: ${s}`);
    });
    await expect(service.run('org1', { ...baseDto }, 'dashboard')).rejects.toThrow(
      /insufficient/i,
    );
    expect(client.verificationRequest.create).not.toHaveBeenCalled();
  });
});
