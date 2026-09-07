-- Add PayPal as a wallet top-up rail alongside stk/bank/card.
-- ADD VALUE (not a type replacement): safe on tables with existing rows,
-- idempotent-safe to re-run mentally (migrations run once via _prisma_migrations).
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'paypal';
