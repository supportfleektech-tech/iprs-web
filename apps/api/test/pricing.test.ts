import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VerificationsService } from '../src/verifications/verifications.service';

describe('Pricing Service', () => {
  let service: VerificationsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      client: {
        productPricing: { findMany: vi.fn(), findUnique: vi.fn() },
        productPricingTier: { findFirst: vi.fn() },
        organizationMonthlyUsage: { findUnique: vi.fn(), upsert: vi.fn() },
        wallet: { findUnique: vi.fn(), update: vi.fn() },
        transaction: { create: vi.fn() },
        verificationRequest: { create: vi.fn(), findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
        verificationBatch: { create: vi.fn(), update: vi.fn() },
      };
    service = new VerificationsService(mockPrisma);
  });

  it('gets correct tier for volume 0-500', async () => {
    mockPrisma.client.productPricingTier.findFirst.mockResolvedValue({
      minVolume: 0, maxVolume: 500, unitPriceMinor: 3000n, backupPriceMinor: 4500n, vatExclusive: true,
    });
    const tier = await service.getCurrentTier('iprs_standard', 100);
    expect(tier.unitPriceMinor).toBe(3000n);
    expect(tier.backupPriceMinor).toBe(4500n);
  });

  it('gets correct tier for volume 501-2500', async () => {
    mockPrisma.client.productPricingTier.findFirst.mockResolvedValue({
      minVolume: 501, maxVolume: 2500, unitPriceMinor: 2800n, backupPriceMinor: 4300n, vatExclusive: true,
    });
    const tier = await service.getCurrentTier('iprs_standard', 1000);
    expect(tier.unitPriceMinor).toBe(2800n);
  });

  it('handles SPIN Score special bands', async () => {
    mockPrisma.client.productPricingTier.findFirst.mockResolvedValue({
      minVolume: 1, maxVolume: 1000, unitPriceMinor: 13000n, backupPriceMinor: null, vatExclusive: true,
    });
    const tier = await service.getCurrentTier('spin_score_only', 500);
    expect(tier.unitPriceMinor).toBe(13000n);
  });
});
EOF