import 'dotenv/config';
import { PrismaClient, VerificationType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * PDF-Exact Pricing Tiers (VAT Exclusive)
 * All prices in KES minor units (cents)
 * Bands: 0-500, 501-2500, 2501-5000, 5001-10000, 10001-30000, 30001+
 * SPIN Score uses: 1-1000, 1001-5000, 5001-10000, 10001-20000, 20001-50000, 50000-100000
 */

interface Tier {
  productType: VerificationType;
  minVolume: number;
  maxVolume: number | null;
  unitPriceMinor: number;
  backupPriceMinor: number | null;
}

const TIERS: Tier[] = [
  // ===== Identity Standard (5 products) =====
  // Bands: 0-500:30, 501-2500:28, 2501-5000:26, 5001-10000:24, 10001-30000:22, 30001+:20
  // Backup: 45/43/42/38/34/32
  ...['iprs_standard', 'match_id_phone', 'employer_verification', 'face_id_match', 'bank_account_verification'].flatMap((type) => [
    { productType: type as VerificationType, minVolume: 0, maxVolume: 500, unitPriceMinor: 3000, backupPriceMinor: 4500 },
    { productType: type as VerificationType, minVolume: 501, maxVolume: 2500, unitPriceMinor: 2800, backupPriceMinor: 4300 },
    { productType: type as VerificationType, minVolume: 2501, maxVolume: 5000, unitPriceMinor: 2600, backupPriceMinor: 4200 },
    { productType: type as VerificationType, minVolume: 5001, maxVolume: 10000, unitPriceMinor: 2400, backupPriceMinor: 3800 },
    { productType: type as VerificationType, minVolume: 10001, maxVolume: 30000, unitPriceMinor: 2200, backupPriceMinor: 3400 },
    { productType: type as VerificationType, minVolume: 30001, maxVolume: null, unitPriceMinor: 2000, backupPriceMinor: 3200 },
  ]),

  // ===== Alien / AML & PEP / Passport =====
  // Bands: 0-500:75, 501-2500:73, 2501-5000:70, 5001-10000:66, 10001-30000:63, 30001+:60
  ...['alien_id', 'aml_pep_screen', 'passport_check'].flatMap((type) => [
    { productType: type as VerificationType, minVolume: 0, maxVolume: 500, unitPriceMinor: 7500, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 501, maxVolume: 2500, unitPriceMinor: 7300, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 2501, maxVolume: 5000, unitPriceMinor: 7000, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 5001, maxVolume: 10000, unitPriceMinor: 6600, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 10001, maxVolume: 30000, unitPriceMinor: 6300, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 30001, maxVolume: null, unitPriceMinor: 6000, backupPriceMinor: null },
  ]),

  // ===== Utility (SIM Swap / KPLC / KRA PIN / Search Name by Phone) =====
  // Bands: 0-500:20, 501-2500:18, 2501-5000:16, 5001-10000:14, 10001-30000:12, 30001+:10
  ...['sim_swap_check', 'kplc_location_checker', 'kra_pin_verification', 'search_name_by_phone'].flatMap((type) => [
    { productType: type as VerificationType, minVolume: 0, maxVolume: 500, unitPriceMinor: 2000, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 501, maxVolume: 2500, unitPriceMinor: 1800, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 2501, maxVolume: 5000, unitPriceMinor: 1600, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 5001, maxVolume: 10000, unitPriceMinor: 1400, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 10001, maxVolume: 30000, unitPriceMinor: 1200, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 30001, maxVolume: null, unitPriceMinor: 1000, backupPriceMinor: null },
  ]),

  // ===== Search Phones by ID =====
  // Bands: 0-500:50, 501-2500:48, 2501-5000:46, 5001-10000:44, 10001-30000:40, 30001+:35
  ...['search_phones_by_id'].flatMap((type) => [
    { productType: type as VerificationType, minVolume: 0, maxVolume: 500, unitPriceMinor: 5000, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 501, maxVolume: 2500, unitPriceMinor: 4800, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 2501, maxVolume: 5000, unitPriceMinor: 4600, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 5001, maxVolume: 10000, unitPriceMinor: 4400, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 10001, maxVolume: 30000, unitPriceMinor: 4000, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 30001, maxVolume: null, unitPriceMinor: 3500, backupPriceMinor: null },
  ]),

  // ===== Motor Vehicle Ownership =====
  // Bands: 0-500:1160, 501-2500:1140, 2501-5000:1115, 5001-10000:1080, 10001-30000:1040, 30001+:1010
  ...['motor_vehicle_ownership'].flatMap((type) => [
    { productType: type as VerificationType, minVolume: 0, maxVolume: 500, unitPriceMinor: 116000, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 501, maxVolume: 2500, unitPriceMinor: 114000, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 2501, maxVolume: 5000, unitPriceMinor: 111500, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 5001, maxVolume: 10000, unitPriceMinor: 108000, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 10001, maxVolume: 30000, unitPriceMinor: 104000, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 30001, maxVolume: null, unitPriceMinor: 101000, backupPriceMinor: null },
  ]),

  // ===== Drivers License Verification =====
  // Bands: 0-500:200, 501-2500:195, 2501-5000:190, 5001-10000:180, 10001-30000:175, 30001+:170
  // Backup: 260/254/248/238/229/221
  ...['drivers_license_verification'].flatMap((type) => [
    { productType: type as VerificationType, minVolume: 0, maxVolume: 500, unitPriceMinor: 20000, backupPriceMinor: 26000 },
    { productType: type as VerificationType, minVolume: 501, maxVolume: 2500, unitPriceMinor: 19500, backupPriceMinor: 25400 },
    { productType: type as VerificationType, minVolume: 2501, maxVolume: 5000, unitPriceMinor: 19000, backupPriceMinor: 24800 },
    { productType: type as VerificationType, minVolume: 5001, maxVolume: 10000, unitPriceMinor: 18000, backupPriceMinor: 23800 },
    { productType: type as VerificationType, minVolume: 10001, maxVolume: 30000, unitPriceMinor: 17500, backupPriceMinor: 22900 },
    { productType: type as VerificationType, minVolume: 30001, maxVolume: null, unitPriceMinor: 17000, backupPriceMinor: 22100 },
  ]),

  // ===== Metropol Score Only =====
  // Bands: 0-500:85, 501-2500:83, 2501-5000:80, 5001-10000:77, 10001-30000:74, 30001+:70
  ...['metropol_score_only'].flatMap((type) => [
    { productType: type as VerificationType, minVolume: 0, maxVolume: 500, unitPriceMinor: 8500, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 501, maxVolume: 2500, unitPriceMinor: 8300, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 2501, maxVolume: 5000, unitPriceMinor: 8000, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 5001, maxVolume: 10000, unitPriceMinor: 7700, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 10001, maxVolume: 30000, unitPriceMinor: 7400, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 30001, maxVolume: null, unitPriceMinor: 7000, backupPriceMinor: null },
  ]),

  // ===== Metropol Standard Report =====
  // Bands: 0-500:150, 501-2500:147, 2501-5000:143, 5001-10000:137, 10001-30000:132, 30001+:128
  ...['metropol_standard_report'].flatMap((type) => [
    { productType: type as VerificationType, minVolume: 0, maxVolume: 500, unitPriceMinor: 15000, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 501, maxVolume: 2500, unitPriceMinor: 14700, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 2501, maxVolume: 5000, unitPriceMinor: 14300, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 5001, maxVolume: 10000, unitPriceMinor: 13700, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 10001, maxVolume: 30000, unitPriceMinor: 13200, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 30001, maxVolume: null, unitPriceMinor: 12800, backupPriceMinor: null },
  ]),

  // ===== Metropol Full Report =====
  // Bands: 0-500:300, 501-2500:295, 2501-5000:285, 5001-10000:275, 10001-30000:265, 30001+:250
  ...['metropol_full_report'].flatMap((type) => [
    { productType: type as VerificationType, minVolume: 0, maxVolume: 500, unitPriceMinor: 30000, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 501, maxVolume: 2500, unitPriceMinor: 29500, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 2501, maxVolume: 5000, unitPriceMinor: 28500, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 5001, maxVolume: 10000, unitPriceMinor: 27500, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 10001, maxVolume: 30000, unitPriceMinor: 26500, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 30001, maxVolume: null, unitPriceMinor: 25000, backupPriceMinor: null },
  ]),

  // ===== CreditInfo =====
  // Flat pricing (no bands)
  { productType: 'creditinfo_score_only' as VerificationType, minVolume: 0, maxVolume: null, unitPriceMinor: 5000, backupPriceMinor: null },
  { productType: 'creditinfo_comprehensive' as VerificationType, minVolume: 0, maxVolume: null, unitPriceMinor: 35000, backupPriceMinor: null },
  { productType: 'creditinfo_crb_status' as VerificationType, minVolume: 0, maxVolume: null, unitPriceMinor: 200000, backupPriceMinor: null },

  // ===== BRS (Business Registration Services) =====
  // Bands: 0-500:1300, 501-2500:1280, 2501-5000:1250, 5001-10000:1205, 10001-30000:1160, 30001+:1125
  ...['brs'].flatMap((type) => [
    { productType: type as VerificationType, minVolume: 0, maxVolume: 500, unitPriceMinor: 130000, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 501, maxVolume: 2500, unitPriceMinor: 128000, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 2501, maxVolume: 5000, unitPriceMinor: 125000, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 5001, maxVolume: 10000, unitPriceMinor: 120500, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 10001, maxVolume: 30000, unitPriceMinor: 116000, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 30001, maxVolume: null, unitPriceMinor: 112500, backupPriceMinor: null },
  ]),

  // ===== SPIN Score Only =====
  // Special bands: 1-1000:130, 1001-5000:125, 5001-10000:120, 10001-20000:115, 20001-50000:105, 50000-100000:95
  ...['spin_score_only'].flatMap((type) => [
    { productType: type as VerificationType, minVolume: 1, maxVolume: 1000, unitPriceMinor: 13000, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 1001, maxVolume: 5000, unitPriceMinor: 12500, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 5001, maxVolume: 10000, unitPriceMinor: 12000, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 10001, maxVolume: 20000, unitPriceMinor: 11500, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 20001, maxVolume: 50000, unitPriceMinor: 10500, backupPriceMinor: null },
    { productType: type as VerificationType, minVolume: 50000, maxVolume: 100000, unitPriceMinor: 9500, backupPriceMinor: null },
  ]),

  // ===== Scanned Statement =====
  // Formula: 120 + pages*4 (VAT Exclusive) - handled at runtime, not tiered
  { productType: 'scanned_statement' as VerificationType, minVolume: 0, maxVolume: null, unitPriceMinor: 12000, backupPriceMinor: null },
];

export async function seedPricingTiers(client: PrismaClient = prisma) {
  console.log('Seeding pricing tiers…');

  for (const tier of TIERS) {
    await client.productPricingTier.upsert({
      where: {
        productType_minVolume: {
          productType: tier.productType,
          minVolume: tier.minVolume,
        },
      },
      update: {
        maxVolume: tier.maxVolume,
        unitPriceMinor: BigInt(tier.unitPriceMinor),
        backupPriceMinor: tier.backupPriceMinor ? BigInt(tier.backupPriceMinor) : null,
        vatExclusive: true,
      },
      create: {
        productType: tier.productType,
        minVolume: tier.minVolume,
        maxVolume: tier.maxVolume,
        unitPriceMinor: BigInt(tier.unitPriceMinor),
        backupPriceMinor: tier.backupPriceMinor ? BigInt(tier.backupPriceMinor) : null,
        vatExclusive: true,
      },
    });
  }

  // Also seed the base ProductPricing.active = true for all types
  const allTypes = [...new Set(TIERS.map((t) => t.productType))];
  for (const type of allTypes) {
    const firstTier = TIERS.find((t) => t.productType === type && t.minVolume === (type === 'spin_score_only' ? 1 : 0));
    if (firstTier) {
      await client.productPricing.upsert({
        where: { type },
        update: { priceMinor: BigInt(firstTier.unitPriceMinor), active: true },
        create: { type, priceMinor: BigInt(firstTier.unitPriceMinor), active: true },
      });
    }
  }

  console.log(`Seeded ${TIERS.length} pricing tiers for ${allTypes.length} products.`);
}

async function main() {
  await seedPricingTiers();
}

// Only auto-run when executed directly (`tsx prisma/tier-seed.ts` / `seed:tiers`).
// seed.ts imports seedPricingTiers() and must not trigger a second run on import.
if (process.argv[1]?.endsWith('tier-seed.ts')) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}