import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'reflect-metadata';
import { PaymentsService } from '../src/payments/payments.service';
import { MockGateway } from '../src/payments/gateway';

function makeDeps() {
  const store = new Map<string, Record<string, unknown>>();
  const client = {
    stkPayment: {
      create: vi.fn().mockImplementation(({ data }) => {
        const row = {
          id: 'pay1',
          status: 'pending',
          merchantRequestId: null,
          checkoutRequestId: null,
          mpesaReceipt: null,
          resultDesc: null,
          completedAt: null,
          ...data,
        };
        store.set('pay1', row);
        return Promise.resolve(row);
      }),
      findUnique: vi.fn().mockImplementation(({ where }) =>
        Promise.resolve(
          where.id ? store.get(where.id) ?? null : [...store.values()].find((r) => r.checkoutRequestId === where.checkoutRequestId) ?? null,
        ),
      ),
      findUniqueOrThrow: vi.fn().mockImplementation(({ where }) => Promise.resolve(store.get(where.id)!)),
      update: vi.fn().mockImplementation(({ where, data }) => {
        const row = store.get(where.id);
        if (row) Object.assign(row, data);
        return Promise.resolve(row);
      }),
      updateMany: vi.fn().mockImplementation(({ where, data }) => {
        const row = store.get(where.id);
        if (!row || row.status !== 'pending') return Promise.resolve({ count: 0 });
        Object.assign(row, data);
        return Promise.resolve({ count: 1 });
      }),
    },
    wallet: {
      update: vi.fn().mockResolvedValue({ id: 'w1', balanceMinor: BigInt(2_000_000) }),
    },
    transaction: { create: vi.fn().mockResolvedValue({}) },
  };
  // $transaction passes ops through sequentially against the same fake client.
  const prisma = {
    client: new Proxy(client, {
      get(target, prop) {
        if (prop === '$transaction') {
          // Supports both array-of-promises and interactive callback forms.
          return (ops: unknown[] | ((tx: unknown) => Promise<unknown>)) =>
            typeof ops === 'function' ? ops(client as never) : Promise.all(ops);
        }
        return target[prop as keyof typeof target];
      },
    }),
  } as never;

  const service = new PaymentsService(prisma);
  return { service, client, store };
}

describe('PaymentsService (mock gateway)', () => {
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    deps = makeDeps();
  });

  it('initiates an STK push and stores both request ids', async () => {
    const payment = await deps.service.initiateStkPush('org1', 'u1', 1000, '0712345678');
    expect(payment.checkoutRequestId).toMatch(/^ws_CO_MOCK_/);
    expect(payment.merchantRequestId).toBeTruthy();
  });

  it('credits the wallet exactly once when the callback lands', async () => {
    const payment = await deps.service.initiateStkPush('org1', 'u1', 1000, '0712345678');

    await deps.service.applyCallback({
      reference: payment.id,
      checkoutRequestId: payment.checkoutRequestId!,
      success: true,
      mpesaReceipt: 'QK77XYZ',
      resultDesc: 'The service request is processed successfully.',
    });

    expect(deps.client.wallet.update).toHaveBeenCalledTimes(1);
    expect(deps.client.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'topup', description: expect.stringContaining('QK77XYZ') }),
    });

    // A duplicate callback must be a no-op
    await deps.service.applyCallback({
      reference: payment.id,
      checkoutRequestId: payment.checkoutRequestId!,
      success: true,
      mpesaReceipt: 'DUP',
    });
    expect(deps.client.wallet.update).toHaveBeenCalledTimes(1);
  });

  it('rejects callbacks whose checkout id does not match our record', async () => {
    const payment = await deps.service.initiateStkPush('org1', 'u1', 1000, '0712345678');
    await expect(
      deps.service.applyCallback({
        reference: payment.id,
        checkoutRequestId: 'spoofed-id',
        success: true,
      }),
    ).rejects.toThrow(/mismatch/i);
    expect(deps.client.wallet.update).not.toHaveBeenCalled();
  });

  it('marks failed callbacks without crediting anything', async () => {
    const payment = await deps.service.initiateStkPush('org1', 'u1', 1000, '0712345678');
    await deps.service.applyCallback({
      reference: payment.id,
      checkoutRequestId: payment.checkoutRequestId!,
      success: false,
      resultDesc: 'Request cancelled by user',
    });
    expect(deps.client.wallet.update).not.toHaveBeenCalled();
    const row = deps.store.get(payment.id)!;
    expect(row.status).toBe('failed');
    expect(row.resultDesc).toMatch(/cancelled/i);
  });
});

describe('MockGateway timing', () => {
  it('auto-completes after its timer fires', async () => {
    vi.useFakeTimers();
    let notified: string | null = null;
    const gw = new MockGateway((id) => {
      notified = id;
    });

    const init = await gw.initiateStk({ amountMinor: BigInt(100_000), phone: '254712345678', reference: 'ref' });
    expect(await gw.queryStk(init.checkoutRequestId)).toEqual({ status: 'pending' });

    await vi.advanceTimersByTimeAsync(3100);
    expect(notified).toBe(init.checkoutRequestId);
    const result = await gw.queryStk(init.checkoutRequestId);
    expect(result.status).toBe('paid');
    expect(result.mpesaReceipt).toMatch(/^MOCK/);
    vi.useRealTimers();
  });
});
