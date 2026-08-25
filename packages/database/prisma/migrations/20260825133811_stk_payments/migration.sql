-- CreateTable
CREATE TABLE "stk_payments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "merchantRequestId" TEXT,
    "checkoutRequestId" TEXT,
    "mpesaReceipt" TEXT,
    "resultDesc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "stk_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stk_payments_checkoutRequestId_key" ON "stk_payments"("checkoutRequestId");

-- CreateIndex
CREATE INDEX "stk_payments_organizationId_createdAt_idx" ON "stk_payments"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "stk_payments_checkoutRequestId_idx" ON "stk_payments"("checkoutRequestId");
