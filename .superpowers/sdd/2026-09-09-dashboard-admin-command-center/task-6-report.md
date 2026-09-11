# Task 6 Report — Rebuild admin command center

**Base:** `2125576`  
**Commit:** `6bbc09e` feat(dashboard): rebuild admin command center with KPIs, top-up queue, catalog, tiers, org management, api-keys  
**Date:** 2026-09-10

## Summary

Rebuilt `apps/dashboard/src/app/admin/page.tsx` from a 386-line monolith (2 parallel fetches, inline pricing/org editing) into a platform command center per spec §4 Admin and brief Task-6. Created `admin-command-center.tsx` as the composition root that fetches **6 endpoints in parallel** via `Promise.allSettled` (`/admin/stats`, `/admin/top-ups`, `/admin/products`, `/admin/organizations`, `/admin/pricing`, `/admin/pricing/tiers`), renders platform KPIs in first viewport, pending top-up queue with org context + explicit approve/reject, product catalog with active switches/pricing/backup/consent/upload + save states, delegates to `price-editor.tsx` (global tiers + simple pricing) and `org-management.tsx` (org table + per-org pricing/availability), and embeds improved `api-keys.tsx` (one-time secret, env badges, permission labels). Extracted reusable `admin-table.tsx` and pure helpers `lib/admin.ts` with 21 tests for price formatting / tier selection / org normalization. Preserved provider/consent/pricing/export contracts, strict types, 44px targets, semantic labels, reduced-motion, never log PII.

## Files Changed

- `apps/dashboard/src/app/admin/page.tsx` — **Modified** — Complete rebuild: auth-gated (`isPlatformAdmin || OWNER`), local state for 6 resources (`stats/topUps/products/orgs/pricing/tiers`), `load()` does `Promise.allSettled` for 6 GETs with `Authorization Bearer`, resilient to 403 (OWNER without platform scope yields empty arrays), `loading`/`error` with retry, renders `<AdminCommandCenter loading/error/onRetry/onReload>` inside `max-w-6xl` canvas. No direct UI — delegates to command center. Fetches 6 in parallel per brief.
- `apps/dashboard/src/app/admin/admin-command-center.tsx` — **Created** — `AdminCommandCenter({stats,topUps,products,pricing,pricingTiers,organizations,token,loading,error,onRetry,onReload})`. Sections: header + `StatCard` KPIs (Organizations/Verifications/Pending, `formatCount`, amber/teal accent), top-up queue (`Badge amber/green/red`, org context, `Approve & credit h-11` + `Reject h-11` via `POST /admin/top-ups/:id/review` with `reviewBusy`, `role=status/alert` + Retry), product catalog (list per `ProductPricing` from `/admin/products` fallback `/admin/pricing`, label via `PRODUCT_LABELS`, category via `getProductCategory`, `CB consent required` amber + `File upload` blue + `Active/Inactive` + pricing `formatPriceMinor` + backup from tiers, toggle `checkbox h-4` + `PUT /admin/products/:type/active` with saving + retry), delegates `PriceEditor` + `OrgManagement` + `ApiKeysSection`. Handles `loading` skeletons + `error` red card with Retry. All amounts VAT-exclusive, backup note, 44px, `role=alert/status`, `aria-label`.
- `apps/dashboard/src/components/admin-table.tsx` — **Created** — `AdminTable<T>({columns,rows,loading,error,onRetry,emptyContent,sortKey,sortDirection,onSort,getRowKey,caption,ariaLabel})`. Mirrors `DataTable` semantics for admin: loading `LoadingState`, error `role=alert` red card + Retry `h-11`, empty `sr-only caption`, table `overflow-x-auto`, sticky-header-ready `thead bg-slate-50/60`, sort buttons `h-11` `aria-sort` `aria-label`, rows `hover:bg-slate-50/60 motion-reduce:transition-none`, `aria-label`/`caption`. Used by `OrgManagement` for org table.
- `apps/dashboard/src/components/price-editor.tsx` — **Created** — `PriceEditor({tiers,pricing,token,onSavePricing,onUpdateTier})`. Two cards: _Global product pricing_ (per `pricing` list, `formatPriceMinor`, `Badge green/red` active, inline `Input h-11` + `Save h-11` via `onSavePricing` with `validatePriceInput`, `role=alert` + Retry, `role=status` success) + _Global tier editor_ (grouped by `productType` `tierRangeLabel`, bands count, per-tier `unitPriceMinor` + `backupPriceMinor` inputs `h-11`, `Save h-11` via `PUT /admin/pricing/tiers/:id` with `validateMinorInput`, VAT-exclusive note, volume bands copy, retryable errors). Reduced-motion, semantic labels (`Label htmlFor`, `aria-describedby`, `aria-label`), tabular-nums.
- `apps/dashboard/src/components/org-management.tsx` — **Created** — `OrgManagement({organizations,token,onReloadOrgs})`. Org table via `AdminTable` (Name/Users/Balance `formatPriceMinor`/Manage `h-11` Selected/Manage), selected state with Clear + Reload. On `Manage` fetches `GET /admin/organizations/:id/enabled-checks` + `GET /admin/organizations/:id/pricing-tiers` in parallel, normalizes via helpers (`checkEdits` map default true, `pricingEdits/Ids`), renders _Enabled checks_ grid (`VERIFICATION_TYPES` checkboxes `h-4`, `Save availability h-11` via `PUT /admin/organizations/:id/enabled-checks` diff-only, retryable `checksErr`) + _Organization pricing overrides_ list (`Input h-11` minor units, `Save h-11` via `PUT/POST /admin/organizations/:id/pricing-tiers`, `validateMinorInput`, per-type `role=alert` + Retry, `formatPriceMinor` override label). Explicit validation, 44px, `aria-label`, reduced-motion, vault-grade copy.
- `apps/dashboard/src/components/api-keys.tsx` — **Modified** — Improve creation/revoke UI: state `copied/creating/revokingId`, validates name >=2, `h-11` inputs/select with `Badge` env chip, `Create key h-11` with `Creating…`, one-time secret disclosure `role=alert` `aria-live=assertive` with teal border, code `break-all font-mono`, `Copy h-11` via `navigator.clipboard` + `Copied ✓` 2s + `Dismiss` + never logs secret, per-row `Environment` badge red/blue + `Permissions` column (`All enabled products`/`Sandbox only`), `Revoke h-11` with `Revoking…`, `opacity-50 bg-slate-50/50` for revoked, `aria-label` per action, `role=status/alert` messages.
- `apps/dashboard/src/lib/admin.ts` — **Created** — Pure helpers (no PII): types `AdminStats/AdminTopUp/ProductPricing/ProductPricingTier/OrgPricingTier/OrgEnabledCheck/OrgSummary`, `minorToKes` (bigint/string/number/null → KES), `formatPriceMinor` (`KES 30.00` 2 decimals), `formatKes`/`formatKesCompact`, `tierRangeLabel` (`30,001+`/`0–500`), `selectTierForVolume<T>` (mirrors `VerificationsService.selectTierInMemory` desc-sorted, null on empty/below min), `groupTiersByProduct` (asc `minVolume`), `normalizeOrgPricingTiers` (`edits/ids` maps, last wins), `normalizeGlobalTiers`, `validatePriceInput`/`validateMinorInput`/`validateTierPrice`, catalog enrichment `requiresFileUpload`/`getFileTypes`/`requiresCbConsent`/`getProductLabel`/`getProductCategory`/`getAllProductTypes`, `formatCount`/`formatTopUpMinor`. Strict, deterministic, VAT-exclusive.
- `apps/dashboard/src/lib/admin.test.ts` — **Created** — 21 vitest cases (see Tests).

## Interfaces & Contracts

- `AdminCommandCenter` accepts `stats:AdminStats|null`, `topUps:AdminTopUp[]`, `products:ProductPricing[]`, `pricing:ProductPricing[]`, `pricingTiers:ProductPricingTier[]`, `organizations:OrgSummary[]`, `token:string|null`, `loading?`, `error?`, `onRetry?`, `onReload:()=>Promise<void>`.
- `PriceEditor` accepts `tiers:ProductPricingTier[]`, `pricing:{id,type,priceMinor,active}[]`, `token`, `onSavePricing:(type,priceKes)=>Promise<void>`, `onUpdateTier:(id,dto)=>Promise<void>`, optional `onCreateTier`.
- `OrgManagement` accepts `organizations:OrgSummary[]`, `token:string|null`, `onReloadOrgs?`. Internally fetches per-org `enabled-checks` + `pricing-tiers` on Manage; save via `PUT /admin/organizations/:id/enabled-checks` + `PUT/POST /admin/organizations/:id/pricing-tiers` with validation.
- `AdminTable<T>` accepts `columns:AdminTableColumn<T>[]`, `rows:T[]`, `loading?`, `error?`, `onRetry?`, `emptyContent?`, `sortKey?`, `sortDirection?`, `onSort?`, `getRowKey`, `caption?`, `ariaLabel?`.

## API Preservation

- Uses existing `GET /v1/admin/stats` → `AdminStats`, `GET /v1/admin/top-ups` → `TopUp[]` + `POST /v1/admin/top-ups/:id/review {approve}`, `GET /v1/admin/products` (platform admin) + `PUT /v1/admin/products/:type/active {active}`, `GET /v1/admin/pricing` + `POST /v1/admin/pricing {type,price}`, `GET /v1/admin/pricing/tiers` + `PUT /v1/admin/pricing/tiers/:id {unitPriceMinor,backupPriceMinor}`, `GET /v1/admin/organizations` + `GET /v1/admin/organizations/:id/enabled-checks` + `PUT /v1/admin/organizations/:id/enabled-checks` + `GET/POST/PUT /v1/admin/organizations/:id/pricing-tiers`, `GET /v1/keys` + `POST /v1/keys` + `DELETE /v1/keys/:id` — all via `apiFetch` with Bearer, preserving provider live/backup routing, CB consent gating, VAT-exclusive tier pricing, and export wallet/verification contracts (untouched).
- No credential leakage, no PII in logs, field-level encryption unchanged, `USE_LIVE_UPSTREAM`/`LIVE_CHECKS`/`BACKUP_CHECKS` honored server-side.

## UI / A11y / Constraints

- **Explicit states:** Loading skeletons (`aria-busy` + `animate-pulse motion-reduce:animate-none`), empty `EmptyState` per section (top-ups, catalog, tiers, orgs, keys), error `role=alert` red cards with Retry covering all 6 fetches + per-action retry (top-up, active toggle, tier save, org checks/pricing, api-keys), success `role=status aria-live=polite` teal banners near action.
- **Semantic labels:** KPIs `section aria-label="Platform KPIs"`, top-ups `aria-label="Top-up requests"`, catalog `aria-label="Product catalog"`, tables `aria-label` + `caption sr-only` + `scope=col` + `aria-sort`, inputs `Label htmlFor` + `aria-describedby` + `aria-label`, buttons `aria-label` per item, checkboxes `aria-label="{type} enabled"`, secret `aria-label="New API key secret"` + `role=alert`.
- **44px targets:** KPIs not interactive, top-up Approve/Reject `h-11`, catalog toggle row `h-4` inside `px-3 py-2` tappable label, catalog inputs not applicable, pricing/tier inputs `h-11`, tier/price Save `h-11`, org Manage `h-11`, enabled Save `h-11`, org pricing Save `h-11`, api-keys inputs `h-11`, Create `h-11`, Copy/Dismiss `h-11`, Revoke `h-11`, sort buttons `h-11`.
- **Reduced-motion:** All `transition-colors` with `motion-reduce:transition-none`, `animate-pulse motion-reduce:animate-none`, `duration-200` not used but where present would be motion-reduce; `globals.css` global `prefers-reduced-motion` disables animations.
- **Product catalog compliance:** Consent chip amber when `requiresCbConsent`, upload chip blue when `requiresFileUpload`, live/backup indicators from tiers, pricing VAT-exclusive copy, backup note.

## Tests

All tests via `npx vitest run`.

**New:** `apps/dashboard/src/lib/admin.test.ts` — **21 passed**

- `minorToKes/formatPriceMinor/formatKes/tierRangeLabel` (4): 3000→30, `KES 30.00`, invalid→`KES 0.00`, `0–500`/`30,001+`.
- `selectTierForVolume` (4): 0→3000, 501→2800, spin 1→3000/25000→1200/0→null, empty→null, 999999→2000 open-ended.
- `groupTiersByProduct` (1): groups `iprs_standard` asc by minVolume.
- `normalizeOrgPricingTiers` (3): `iprs_standard→3000/a`, empty→`{}`, last wins `3500/second`.
- `normalizeGlobalTiers` (1): asc sort.
- `validation` (3): `validatePriceInput` empty→Enter, `abc`→number, `0`→≥1, `30`→null; `validateMinorInput` `99`→≥100; `validateTierPrice`.
- `product catalog helpers` (5): `requiresFileUpload` true for face/brs/scanned, `requiresCbConsent` true for metropol/brs, `getProductLabel` IPRS→`IPRS Standard Verification`, `getProductCategory` iprs→`Identity — Standard`, `formatCount` 1234→`1,234`.

**Existing suites still green:**

- `history.test.ts` — 27 passed
- `overview.test.ts` — 19 passed
- `verification-form.test.ts` — 22 passed
- `wallet.test.ts` — 15 passed
- **Total `apps/dashboard/src/lib`:** 5 files, **107 passed**.

## Verification Performed

- `pnpm --filter @fleek/dashboard typecheck` — **pass** (tsc --noEmit, 0 errors; fixed bigint union on PriceEditor)
- `pnpm --filter @fleek/dashboard lint` — **pass** (0 errors, 0 warnings; fixed unused Input/Label, _pricingTiers via eslint-disable)
- `pnpm -w lint` — **pass** (7 tasks, dashboard 0 warnings; API 3 pre-existing warnings unchanged)
- `pnpm -w typecheck` — **pass** (10/10 tasks, turbo)
- `pnpm -w build` — **pass** (dashboard 14/14 static pages, `/admin` 9.74 kB; web 38/38)
- `npx vitest run apps/dashboard/src/lib/admin.test.ts --reporter=verbose` — **21/21 passed**
- `npx vitest run apps/dashboard/src/lib --reporter=verbose` — **107/107 passed**

## Commits

- `6bbc09e` feat(dashboard): rebuild admin command center with KPIs, top-up queue, catalog, tiers, org management, api-keys (8 files, +1812/-412)

## Fix Round 1 — 2026-09-10 (review 2125576..6bbc09e — I-1..I-6, M-1/M-5)

**Base for fix:** `6bbc09e` — Findings addressed: I-1..I-6 (Important), M-1, M-5 (Minor).

### Fixes

- **I-1 Catalog backup price lossy/first-wins** — `apps/dashboard/src/app/admin/admin-command-center.tsx:68-86` — Replaced `tierBackupByType` first-wins `Map.has` with `backupByType: Map<string, number[]>` collecting all `backupPriceMinor` per product. Added `getBackupLabel()` + `hasHeterogeneousBackup()`: single unique → `formatPriceMinor`; heterogeneous → `from KES X.00` (lowest) with `title="Backup varies by tier — see tier editor for per-tier values"` to avoid misleading badge. Per-tier backup still shown in tier editor list (`Current … · backup KES`). Hardcoded `/ 24` badge replaced with `/ {VERIFICATION_TYPES.length}`.
- **I-2 Partial-failure error suppression** — `apps/dashboard/src/app/admin/page.tsx:55-72` — Changed `criticalFailed = stats&&topUps&&pricing` (only all-three) to `failures = 6 endpoints` with `anyRejected` check. Builds `Some admin data failed to load (labels) — details — retry` message joining per-endpoint `reason.message`. Resets `error=null` when none failed. `AdminCommandCenter` no longer short-circuits on error (`if(error) return Card` removed); instead renders inline `role=alert` banner at top with Retry button and keeps KPIs/catalog/tiers/orgs visible (partial data still shown).
- **I-3 PriceEditor contract drift token** — `apps/dashboard/src/components/price-editor.tsx:8-14,22` — Removed `token: string|null` from `PriceEditorProps` (parent handles `apiFetch` via callbacks `onSavePricing/onUpdateTier`). Updated call site `admin-command-center.tsx:329` to not pass `token`. Strict types now match usage.
- **I-4 admin.ts incorrectly 'use client'** — `apps/dashboard/src/lib/admin.ts:1` — Removed `'use client'` directive; pure helpers are server-safe (no hooks).
- **I-5 Tier backup validation redundant + off-by-one** — `apps/dashboard/src/components/price-editor.tsx:78-86` — Replaced `if (trim && validateMinorInput && Number!==0) double-call` with `if (trim==='') backup=null else { err=validateMinorInput(backupStr); if(err) return; }`, single validation call, 0 now correctly fails `>=100` rule.
- **I-6 Unused state with lint suppression** — `apps/dashboard/src/components/org-management.tsx:54-56` — Removed `// eslint-disable-next-line` + `[_pricingTiers,setPricingTiers]` state; `loadOrgDetails` only populates `pricingEdits`/`pricingIds` (maps `productType→unitPriceMinor/id`). No suppressed unused vars; `useState` import clean.
- **M-1 selectTierForVolume fallback ambiguous** — `apps/dashboard/src/lib/admin.ts:117-133` — Added `[...tiers].sort((a,b)=>b.minVolume-a.minVolume)` inside function; no longer requires caller to pre-sort desc. Fallback logic uses sorted copy.
- **M-5 hardcoded /24 badge** — `apps/dashboard/src/app/admin/admin-command-center.tsx:6,259` — Added `VERIFICATION_TYPES` import; badge now `{VERIFICATION_TYPES.length}` (24) derived.

### Verification (re-run)

- `pnpm --filter @fleek/dashboard typecheck` — **pass** (tsc --noEmit, 0 errors)
- `pnpm -w typecheck` — **pass** (10/10 tasks)
- `pnpm --filter @fleek/dashboard lint` — **pass** (0 errors, 0 warnings)
- `pnpm -w lint` — **pass** (dashboard 0 warnings; API 3 pre-existing warnings unchanged)
- `pnpm -w build` — **pass** (dashboard 14/14 static pages, `/admin` 9.94 kB; web 38/38)
- `npx vitest run apps/dashboard/src/lib/admin.test.ts --reporter=verbose` — **21/21 passed**
- `npx vitest run apps/dashboard/src/lib --reporter=verbose` — **107/107 passed** (5 files)
- Existing `selectTierForVolume` tests still pass with internal sort; unsorted input now handled correctly.

### Remaining minor (deferred)

- **M-7 duplicate products vs pricing fetch** — Still fetches both `/admin/products` and `/admin/pricing` (6 parallel). Catalog dedupes via `products.length>0?products:pricing`. Accepted per report; not changed (would require API contract decision).
- **Org pricing multi-tier** — Schema is `@@unique([orgId,productType])` so single `unitPriceMinor` per org+type is correct; removed unused full-tier state rather than adding tier list UI.

## Concerns / Follow-ups

- **Tier creation:** `PriceEditor` currently supports `PUT` updates for existing tiers; `POST /admin/pricing/tiers` creation exists in API but UI has no create form (brief did not require). Can add if admin needs ad-hoc bands.
- **Products vs pricing duplication:** Page fetches both `/admin/products` and `/admin/pricing` (both `ProductPricing`). Command center prefers `products` then falls back to `pricing`; if both return same 24 rows, catalog dedupes correctly. If API later diverges, consider fetching one.
- **Vitest dashboard:** No per-app `test` script; run via `npx vitest run apps/dashboard/src/lib/*`. Previous task suggested adding `"test": "vitest run"` to dashboard.

## Report Path

`/home/zingri/dev/IPRS-WEB/.superpowers/sdd/2026-09-09-dashboard-admin-command-center/task-6-report.md`
