import 'dotenv/config';
import { PrismaClient, VerificationType } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding…');

  for (const [type, price] of [
    [VerificationType.iprs_id, 5000],
    [VerificationType.kra_pin, 3000],
    [VerificationType.phone_ownership, 2000],
    [VerificationType.sim_swap, 2000],
  ] as const) {
    await prisma.productPricing.upsert({
      where: { type },
      update: { priceMinor: BigInt(price) },
      create: { type, priceMinor: BigInt(price), active: true },
    });
  }

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

  console.log('Seed complete. Login: admin@fleektech.co.ke / Admin123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
