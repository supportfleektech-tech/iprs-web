-- Revenue split: persist the vendor (SPIN Mobile) share and the Fleek IPRS
-- margin (KES 5 per successful request) beside the user-facing total.
-- Backfill: rows billed before the margin existed carry vendor = total,
-- margin = 0, so historical reports stay exact.
ALTER TABLE "verification_requests" ADD COLUMN "vendorCostMinor" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "verification_requests" ADD COLUMN "marginMinor" BIGINT NOT NULL DEFAULT 0;

UPDATE "verification_requests"
SET "vendorCostMinor" = "costMinor", "marginMinor" = 0
WHERE "status" = 'success';
