-- Fix SPIN Score bands: gap at volume 0 (first min_volume was 1 → new orgs
-- 400'd with "No pricing tier configured"), overlap at 50000 (two rows
-- matched), closed top at 100000 (volume >100k unbilled). Bands now tile
-- [0, ∞): 0-1000:130, 1001-5000:125, 5001-10000:120, 10001-20000:115,
-- 20001-50000:105, 50001+:95 (KES minor, VAT exclusive).
DELETE FROM "product_pricing_tiers" WHERE "product_type" = 'spin_score_only';

INSERT INTO "product_pricing_tiers"
  ("id", "product_type", "min_volume", "max_volume", "unit_price_minor", "backup_price_minor", "vat_exclusive", "updated_at")
VALUES
  (gen_random_uuid()::text, 'spin_score_only', 0, 1000, 13000, NULL, true, NOW()),
  (gen_random_uuid()::text, 'spin_score_only', 1001, 5000, 12500, NULL, true, NOW()),
  (gen_random_uuid()::text, 'spin_score_only', 5001, 10000, 12000, NULL, true, NOW()),
  (gen_random_uuid()::text, 'spin_score_only', 10001, 20000, 11500, NULL, true, NOW()),
  (gen_random_uuid()::text, 'spin_score_only', 20001, 50000, 10500, NULL, true, NOW()),
  (gen_random_uuid()::text, 'spin_score_only', 50001, NULL, 9500, NULL, true, NOW());
