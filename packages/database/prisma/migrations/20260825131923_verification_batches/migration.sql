-- AlterTable
ALTER TABLE "verification_requests" ADD COLUMN     "batchId" TEXT;

-- CreateTable
CREATE TABLE "verification_batches" (
    "id" TEXT NOT NULL,
    "type" "VerificationType" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "totalRows" INTEGER NOT NULL,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "notFoundCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "verification_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_batches_organizationId_createdAt_idx" ON "verification_batches"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "verification_requests_batchId_idx" ON "verification_requests"("batchId");

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "verification_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_batches" ADD CONSTRAINT "verification_batches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
