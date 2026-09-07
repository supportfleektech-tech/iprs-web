-- Sync database to schema.prisma: schema was extended to 24 verification products
-- plus backup/consent columns and org tables without a corresponding migration,
-- so prod (5 applied migrations) still has the 4-value scaffold enum and is
-- missing columns. This migration closes that drift in dependency-safe order.
--
-- NOTE on the enum replacement: the old scaffold values
-- ('iprs_id','kra_pin','phone_ownership','sim_swap') are dropped. The USING
-- cast fails loudly if any row still uses them — backfill/delete such rows
-- before deploying. Prod is empty at this point (seed never succeeded), so
-- this applies cleanly there.

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('stk', 'bank', 'card');

-- AlterEnum: replace scaffold VerificationType with the 24 product values.
-- Only existing tables are altered here; org_* tables are created below
-- already using the new enum.
BEGIN;
CREATE TYPE "VerificationType_new" AS ENUM ('iprs_standard', 'match_id_phone', 'employer_verification', 'face_id_match', 'bank_account_verification', 'alien_id', 'aml_pep_screen', 'passport_check', 'sim_swap_check', 'kplc_location_checker', 'kra_pin_verification', 'search_name_by_phone', 'search_phones_by_id', 'motor_vehicle_ownership', 'drivers_license_verification', 'metropol_score_only', 'metropol_standard_report', 'metropol_full_report', 'creditinfo_score_only', 'creditinfo_comprehensive', 'creditinfo_crb_status', 'brs', 'spin_score_only', 'scanned_statement');
ALTER TABLE "verification_requests" ALTER COLUMN "type" TYPE "VerificationType_new" USING ("type"::text::"VerificationType_new");
ALTER TABLE "verification_batches" ALTER COLUMN "type" TYPE "VerificationType_new" USING ("type"::text::"VerificationType_new");
ALTER TABLE "product_pricing" ALTER COLUMN "type" TYPE "VerificationType_new" USING ("type"::text::"VerificationType_new");
ALTER TABLE "product_pricing_tiers" ALTER COLUMN "product_type" TYPE "VerificationType_new" USING ("product_type"::text::"VerificationType_new");
ALTER TABLE "organization_monthly_usage" ALTER COLUMN "product_type" TYPE "VerificationType_new" USING ("product_type"::text::"VerificationType_new");
ALTER TYPE "VerificationType" RENAME TO "VerificationType_old";
ALTER TYPE "VerificationType_new" RENAME TO "VerificationType";
DROP TYPE "VerificationType_old";
COMMIT;

-- DropIndex: not defined in schema.prisma
DROP INDEX "organization_monthly_usage_org_id_idx";

-- AlterTable
ALTER TABLE "stk_payments" ADD COLUMN     "method" "PaymentMethod" NOT NULL DEFAULT 'stk',
ADD COLUMN     "paybillRef" TEXT;

-- AlterTable
ALTER TABLE "verification_batches" ADD COLUMN     "isBackup" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "verification_requests" ADD COLUMN     "cbConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isBackup" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "org_enabled_checks" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "productType" "VerificationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "org_enabled_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_pricing_tiers" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "productType" "VerificationType" NOT NULL,
    "minVolume" INTEGER NOT NULL,
    "maxVolume" INTEGER,
    "unitPriceMinor" INTEGER NOT NULL,
    "backupPriceMinor" INTEGER,
    "vatExclusive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "org_pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_enabled_checks_orgId_productType_key" ON "org_enabled_checks"("orgId", "productType");

-- CreateIndex
CREATE UNIQUE INDEX "org_pricing_tiers_orgId_productType_key" ON "org_pricing_tiers"("orgId", "productType");

-- AddForeignKey
ALTER TABLE "org_enabled_checks" ADD CONSTRAINT "org_enabled_checks_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_pricing_tiers" ADD CONSTRAINT "org_pricing_tiers_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
