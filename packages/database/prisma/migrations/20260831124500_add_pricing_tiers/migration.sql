-- CreateTable
CREATE TABLE "product_pricing_tiers" (
    "id" TEXT NOT NULL,
    "product_type" "VerificationType" NOT NULL,
    "min_volume" INTEGER NOT NULL,
    "max_volume" INTEGER,
    "unit_price_minor" BIGINT NOT NULL,
    "backup_price_minor" BIGINT,
    "vat_exclusive" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_monthly_usage" (
    "org_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "product_type" "VerificationType" NOT NULL,
    "success_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "organization_monthly_usage_pkey" PRIMARY KEY ("org_id", "month", "product_type")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_pricing_tiers_product_type_min_volume_key" ON "product_pricing_tiers"("product_type", "min_volume");

-- CreateIndex
CREATE INDEX "product_pricing_tiers_product_type_idx" ON "product_pricing_tiers"("product_type");

-- CreateIndex
CREATE INDEX "organization_monthly_usage_org_id_idx" ON "organization_monthly_usage"("org_id");