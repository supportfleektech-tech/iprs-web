import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VerificationsService } from '../src/verifications/verifications.service';
import { VerificationType } from '@fleek/types';

interface TierRow {
  minVolume: number;
  maxVolume: number | null;
  unitPriceMinor: bigint;
  backupPriceMinor: bigint | null;
  vatExclusive: boolean;
}

const TIERS: TierRow[] = [
  {
    minVolume: 0,
    maxVolume: 500,
    unitPriceMinor: 3000n,
    backupPriceMinor: 4500n,
    vatExclusive: true,
  },
  {
    minVolume: 501,
    maxVolume: 2500,
    unitPriceMinor: 2800n,
    backupPriceMinor: 4300n,
    vatExclusive: true,
  },
  {
    minVolume: 2501,
    maxVolume: 5000,
    unitPriceMinor: 2600n,
    backupPriceMinor: 4200n,
    vatExclusive: true,
  },
  {
    minVolume: 5001,
    maxVolume: 10000,
    unitPriceMinor: 2400n,
    backupPriceMinor: 3800n,
    vatExclusive: true,
  },
  {
    minVolume: 10001,
    maxVolume: 30000,
    unitPriceMinor: 2200n,
    backupPriceMinor: 3400n,
    vatExclusive: true,
  },
  {
    minVolume: 30001,
    maxVolume: null,
    unitPriceMinor: 2000n,
    backupPriceMinor: 3200n,
    vatExclusive: true,
  },
];

describe('Pricing Service', () => {
  let service: VerificationsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      client: {
        productPricing: { findMany: vi.fn(), findUnique: vi.fn() },
        productPricingTier: { findMany: vi.fn(), findFirst: vi.fn() },
        organizationMonthlyUsage: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
        wallet: { findUnique: vi.fn(), update: vi.fn() },
        transaction: { create: vi.fn() },
        verificationRequest: {
          create: vi.fn(),
          findMany: vi.fn(),
          count: vi.fn(),
          findFirst: vi.fn(),
        },
        verificationBatch: { create: vi.fn(), update: vi.fn() },
      },
    };
    service = new VerificationsService(mockPrisma);
  });

  describe('getCurrentTier (DB-backed)', () => {
    it('returns tier for volume 0-500', async () => {
      mockPrisma.client.productPricingTier.findFirst.mockResolvedValue(TIERS[0]!);
      const tier = await service.getCurrentTier(VerificationType.IPRS_STANDARD, 100);
      expect(tier?.unitPriceMinor).toBe(3000n);
      expect(tier?.backupPriceMinor).toBe(4500n);
    });

    it('returns tier for volume 501-2500', async () => {
      mockPrisma.client.productPricingTier.findFirst.mockResolvedValue(TIERS[1]!);
      const tier = await service.getCurrentTier(VerificationType.IPRS_STANDARD, 1000);
      expect(tier?.unitPriceMinor).toBe(2800n);
    });

    it('returns the topmost open-ended tier for volume > 30,000', async () => {
      mockPrisma.client.productPricingTier.findFirst.mockResolvedValue(TIERS[5]!);
      const tier = await service.getCurrentTier(VerificationType.IPRS_STANDARD, 100_000);
      expect(tier?.unitPriceMinor).toBe(2000n);
    });
  });

  describe('selectTierInMemory (used by /verifications/products)', () => {
    /** Tiers must be pre-sorted desc by minVolume per the service's expectation. */
    const desc = [...TIERS].sort((a, b) => b.minVolume - a.minVolume);

    it('picks the 0-500 tier at volume 100', () => {
      const tier = VerificationsService.selectTierInMemory(desc, 100);
      expect(tier?.unitPriceMinor).toBe(3000n);
    });

    it('picks the 501-2500 tier at volume 1000', () => {
      const tier = VerificationsService.selectTierInMemory(desc, 1000);
      expect(tier?.unitPriceMinor).toBe(2800n);
    });

    it('picks the 2501-5000 tier at volume 3000', () => {
      const tier = VerificationsService.selectTierInMemory(desc, 3000);
      expect(tier?.unitPriceMinor).toBe(2600n);
    });

    it('picks the topmost open-ended tier at volume 50,000', () => {
      const tier = VerificationsService.selectTierInMemory(desc, 50_000);
      expect(tier?.unitPriceMinor).toBe(2000n);
    });

    it('returns null for an empty tier list', () => {
      expect(VerificationsService.selectTierInMemory([], 100)).toBeNull();
    });

    it('falls back to the topmost open-ended tier when ranges overlap', () => {
      // Force the strict primary loop to miss by giving every tier a maxVolume.
      const overlapping = desc.map((t) => ({ ...t, maxVolume: t.minVolume + 100 }));
      const tier = VerificationsService.selectTierInMemory(overlapping, 50_000);
      // Second loop returns the first row whose minVolume <= volume.
      expect(tier?.unitPriceMinor).toBe(2000n);
    });

    it('returns null when volume is below the smallest tier', () => {
      const minHigh = [
        {
          minVolume: 100,
          maxVolume: null,
          unitPriceMinor: 100n,
          backupPriceMinor: null,
          vatExclusive: true,
        },
      ];
      expect(VerificationsService.selectTierInMemory(minHigh, 50)).toBeNull();
    });
  });
});
