import 'dotenv/config';
import { PrismaClient, VerificationType } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { seedPricingTiers } from './tier-seed';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding…');

  for (const [type, price] of [
    [VerificationType.iprs_standard, 3000],
    [VerificationType.match_id_phone, 3000],
    [VerificationType.employer_verification, 3000],
    [VerificationType.face_id_match, 3000],
    [VerificationType.bank_account_verification, 3000],
    [VerificationType.alien_id, 7500],
    [VerificationType.aml_pep_screen, 7500],
    [VerificationType.passport_check, 7500],
    [VerificationType.sim_swap_check, 2000],
    [VerificationType.kplc_location_checker, 2000],
    [VerificationType.kra_pin_verification, 2000],
    [VerificationType.search_name_by_phone, 2000],
    [VerificationType.search_phones_by_id, 5000],
    [VerificationType.motor_vehicle_ownership, 116000],
    [VerificationType.drivers_license_verification, 20000],
    [VerificationType.metropol_score_only, 8500],
    [VerificationType.metropol_standard_report, 15000],
    [VerificationType.metropol_full_report, 30000],
    [VerificationType.creditinfo_score_only, 5000],
    [VerificationType.creditinfo_comprehensive, 35000],
    [VerificationType.creditinfo_crb_status, 200000],
    [VerificationType.brs, 130000],
    [VerificationType.spin_score_only, 13000],
    [VerificationType.scanned_statement, 12000],
  ] as const) {
    await prisma.productPricing.upsert({
      where: { type },
      update: { priceMinor: BigInt(price) },
      create: { type, priceMinor: BigInt(price), active: true },
    });
  }

  // Tiered pricing (PDF-exact, VAT-exclusive) — verifications require a tier
  // row per product, so this must run wherever seed.ts runs (CI, Render, local).
  await seedPricingTiers(prisma);

  // Idempotent: safe to run repeatedly against an already-seeded database.
  const org =
    (await prisma.organization.findFirst({ where: { name: 'Demo Lender Ltd' } })) ??
    (await prisma.organization.create({ data: { name: 'Demo Lender Ltd' } }));

  // Re-seed resets the documented demo credentials but leaves wallets alone.
  await prisma.user.upsert({
    where: { email: 'admin@fleektech.co.ke' },
    update: { passwordHash: hashSync('Admin123!', 10) },
    create: {
      email: 'admin@fleektech.co.ke',
      passwordHash: hashSync('Admin123!', 10),
      firstName: 'Fleek',
      lastName: 'Admin',
      role: 'OWNER',
      isPlatformAdmin: true,
      organizationId: org.id,
    },
  });

  await prisma.wallet.upsert({
    where: { organizationId: org.id },
    update: {},
    create: { organizationId: org.id, balanceMinor: 100_000_000 },
  });

  // Platform admins (idempotent upserts — safe to re-run on every deploy).
  for (const [email, password, firstName] of [
    ['fleekiprs@admin.co.ke', 'admin@fleek', 'FleekIPRS'],
    ['zingrimaster@admin.co.ke', 'zing@admin', 'Zingri'],
  ] as const) {
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash: hashSync(password, 10), isPlatformAdmin: true, role: 'OWNER' },
      create: {
        email,
        passwordHash: hashSync(password, 10),
        firstName,
        lastName: 'Admin',
        role: 'OWNER',
        isPlatformAdmin: true,
        organizationId: org.id,
      },
    });
  }

  console.log('Seed complete. Login: admin@fleektech.co.ke / Admin123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
