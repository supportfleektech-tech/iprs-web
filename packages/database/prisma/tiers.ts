import type { VerificationType } from '@prisma/client';

/**
 * Shared pricing-tier data (pure module — no PrismaClient side effects, so
 * unit tests can import it). Bands tile [0, ∞) contiguously per product:
 * first minVolume is 0, each next minVolume is prev maxVolume + 1, the top
 * band is open-ended (maxVolume null).
 */
export interface Tier {
  productType: VerificationType;
  minVolume: number;
  maxVolume: number | null;
  unitPriceMinor: number;
  backupPriceMinor: number | null;
}

/**
 * SPIN Score Only — special PDF-exact bands (KES minor):
 * 0-1000:130, 1001-5000:125, 5001-10000:120, 10001-20000:115,
 * 20001-50000:105, 50001+:95.
 */
export const SPIN_SCORE_TIERS: Tier[] = [
  { productType: 'spin_score_only', minVolume: 0, maxVolume: 1000, unitPriceMinor: 13000, backupPriceMinor: null },
  { productType: 'spin_score_only', minVolume: 1001, maxVolume: 5000, unitPriceMinor: 12500, backupPriceMinor: null },
  { productType: 'spin_score_only', minVolume: 5001, maxVolume: 10000, unitPriceMinor: 12000, backupPriceMinor: null },
  { productType: 'spin_score_only', minVolume: 10001, maxVolume: 20000, unitPriceMinor: 11500, backupPriceMinor: null },
  { productType: 'spin_score_only', minVolume: 20001, maxVolume: 50000, unitPriceMinor: 10500, backupPriceMinor: null },
  { productType: 'spin_score_only', minVolume: 50001, maxVolume: null, unitPriceMinor: 9500, backupPriceMinor: null },
];
