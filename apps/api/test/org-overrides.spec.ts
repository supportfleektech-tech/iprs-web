import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VerificationsService } from '../src/verifications/verifications.service';
import { VerificationType } from '@fleek/types';

const TIER = {
  minVolume: 0,
  maxVolume: 500,
  unitPriceMinor: 3000n,
  backupPriceMinor: 4500n,
  vatExclusive: true,
};

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

function buildMock() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = {
    productPricing: { findMany: vi.fn(), findUnique: vi.fn() },
    productPricingTier: { findMany: vi.fn(), findFirst: vi.fn() },
    organizationMonthlyUsage: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    orgEnabledChecks: { findMany: vi.fn() },
    orgPricingTier: { findMany: vi.fn() },
    wallet: { findUnique: vi.fn(), update: vi.fn() },
    transaction: { create: vi.fn() },
    verificationRequest: { create: vi.fn() },
    // Locked reads mirror the pre-read (volume 0, funded wallet).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $queryRaw: vi.fn(async (q: any) => {
      const s = Array.isArray(q) ? q.join('?') : String(q);
      if (s.includes('organization_monthly_usage')) return [{ volume: 0 }];
      if (s.includes('wallets')) return [{ id: 'w1', balanceMinor: 1_000_000n }];
      throw new Error(`unexpected query: ${s}`);
    }),
  };
  // $transaction replays the callback against the mocked client.
  client.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(client));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockPrisma: any = {
    client,
    encrypt: (v: string) => v,
    decrypt: (v: string) => v,
  };

  const service = new VerificationsService(mockPrisma as never);
  // Deterministic provider: always succeeds, so tests assert pricing/enforcement only.
  (service as unknown as { registry: unknown }).registry = {
    isEnabled: () => true,
    hasBackup: () => false,
    isLive: () => false,
    resolve: () => ({ iprsStandardLookup: async () => FAKE_IPRS_RESULT }),
  };
  return { mockPrisma, client, service };
}

const baseDto = {
  type: VerificationType.IPRS_STANDARD,
  idNumber: '12345678',
  consent: true,
  consentCollectedBy: 'test',
};

describe('org overrides (admin-managed availability & pricing)', () => {
  let client: ReturnType<typeof buildMock>['client'];
  let service: VerificationsService;

  beforeEach(() => {
    ({ client, service } = buildMock());
    client.productPricing.findMany.mockResolvedValue([
      { type: 'iprs_standard', priceMinor: 3000n, active: true },
    ]);
    client.productPricing.findUnique.mockResolvedValue({
      type: 'iprs_standard',
      active: true,
      priceMinor: 3000n,
    });
    client.productPricingTier.findFirst.mockResolvedValue(TIER);
    client.organizationMonthlyUsage.findMany.mockResolvedValue([]);
    client.organizationMonthlyUsage.findUnique.mockResolvedValue(null);
    client.orgEnabledChecks.findMany.mockResolvedValue([]);
    client.orgPricingTier.findMany.mockResolvedValue([]);
    client.wallet.findUnique.mockResolvedValue({ id: 'w1', balanceMinor: 1_000_000n });
    client.wallet.update.mockResolvedValue({ id: 'w1', balanceMinor: 997_000n });
    client.transaction.create.mockResolvedValue({});
    client.organizationMonthlyUsage.upsert.mockResolvedValue({});
    client.verificationRequest.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: 'vr1',
        createdAt: new Date(),
        ...args.data,
      }),
    );
  });

  it('products(): no org rows means globally enabled', async () => {
    const list = await service.products('org1');
    const entry = list.find((p) => p.type === 'iprs_standard');
    expect(entry?.enabled).toBe(true);
  });

  it('products(): explicit enabled=false row disables the type for the org', async () => {
    client.orgEnabledChecks.findMany.mockResolvedValue([
      { productType: 'iprs_standard', enabled: false },
    ]);
    const list = await service.products('org1');
    const entry = list.find((p) => p.type === 'iprs_standard');
    expect(entry?.enabled).toBe(false);
  });

  it('products(): org pricing tier overrides the global unit price', async () => {
    client.orgPricingTier.findMany.mockResolvedValue([
      {
        productType: 'iprs_standard',
        minVolume: 0,
        maxVolume: null,
        unitPriceMinor: 1500,
        backupPriceMinor: null,
      },
    ]);
    const list = await service.products('org1');
    const entry = list.find((p) => p.type === 'iprs_standard');
    expect(entry?.unitPriceKes).toBe(20);
  });

  it('run(): rejects a type the org disabled', async () => {
    client.orgEnabledChecks.findMany.mockResolvedValue([
      { productType: 'iprs_standard', enabled: false },
    ]);
    await expect(service.run('org1', { ...baseDto }, 'dashboard')).rejects.toThrow(
      'not enabled for your organization',
    );
  });

  it('run(): charges the org tier price on success', async () => {
    client.orgPricingTier.findMany.mockResolvedValue([
      {
        productType: 'iprs_standard',
        minVolume: 0,
        maxVolume: null,
        unitPriceMinor: 1500,
        backupPriceMinor: null,
      },
    ]);
    const res = await service.run('org1', { ...baseDto }, 'dashboard');
    expect(res.status).toBe('success');
    expect(res.cost).toBe(20);
  });

  it('run(): charges the global tier price without an org override', async () => {
    const res = await service.run('org1', { ...baseDto }, 'dashboard');
    expect(res.status).toBe('success');
    expect(res.cost).toBe(35);
  });

  it('run(): falls back to the base product price when no tier matches the volume', async () => {
    // Gaps (e.g. admin-created) must not 400 billable checks — the base
    // ProductPricing row is the priced fallback.
    client.productPricingTier.findFirst.mockResolvedValue(null);
    client.productPricing.findMany.mockResolvedValue([
      { type: 'iprs_standard', priceMinor: 3000n, active: true },
    ]);
    const res = await service.run('org1', { ...baseDto }, 'dashboard');
    expect(res.status).toBe('success');
    expect(res.cost).toBe(35);
  });
});
