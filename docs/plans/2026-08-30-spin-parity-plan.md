# Fleek IPRS — SPIN Kenya Parity Implementation Plan

**Date:** 2026-08-30  
**Status:** Executing  
**Branch:** `feature/spin-kenya-parity` (to be created)

---

## Scope Summary

Bring Fleek IPRS to 100% SPIN-Kenya product parity with:

- **24 verification products** (PDF-exact catalog)
- **Volume-tiered VAT-exclusive pricing** (exact PDF bands)
- **Explicit backup toggle** (no silent surcharge)
- **Calendar-month volume** reset at 00:00 EAT 1st
- **Multi-rail wallet** (M-Pesa STK + Bank Paybill 880100/8402250011 + Invoice)
- **Server exports** (CSV/XLSX/PDF for verifications, batches, wallet)
- **Admin live product gating** (real-time active toggle)
- **multipart/form-data** for face/statement/BRS uploads
- **CB consent checkbox** for CRB/BRS products

---

## Phase A — Schema & Seeds (Day 1)

### A1. Prisma Schema Updates

- [ ] Extend `VerificationType` enum with 24 values
- [ ] Add `ProductPricingTier` model
- [ ] Add `OrganizationMonthlyUsage` model
- [ ] Add `isBackup Boolean @default(false)` to `VerificationRequest`
- [ ] Add `cbConsent Boolean @default(false)` to `VerificationRequest`
- [ ] Add `isBackup Boolean @default(false)` to `VerificationBatch`
- [ ] Add `method` to `StkPayment` or create `WalletPayment` unified model
- [ ] Run `prisma generate` + create migration

### A2. Tier Seed Script

- [ ] Create `prisma/tier-seed.ts` with exact PDF bands
- [ ] Handle SPIN Score special bands (1-1000 vs 0-500)
- [ ] All tiers `vatExclusive: true`
- [ ] Idempotent upsert by `(productType, minVolume)`

---

## Phase B — Core Packages & API (Days 2-3)

### B1. Types Package (`packages/types`)

- [ ] Extend `VerificationType` enum (24 values)
- [ ] Add result interfaces for all new products
- [ ] Update `VerificationResultMap`, `VerificationResult`
- [ ] Update `PRODUCT_LABELS` with human-readable names

### B2. Providers Package (`packages/providers`)

- [ ] Extend `VerificationProvider` interface with 20 new methods
- [ ] Implement deterministic `MockProvider` fixtures (hash-seeded)
- [ ] Extend `AggregatorAdapter` to map SPIN endpoints
- [ ] Update `ProviderRegistry` for primary/backup routing

### B3. Verifications Service (`apps/api/src/verifications`)

- [ ] `RunVerificationDto` → add optional fields: `alienId`, `passportNumber`, `nationality`, `bankCode`, `accountNumber`, `meterNumber`, `vehicleReg`, `dlNumber`, `businessRegNo`, `statementPages`, `faceImage`, `cbConsent`, `useBackup`
- [ ] `validateInput` per new type
- [ ] `getCurrentTierPrice(orgId, type)` → calendar-month lookup
- [ ] `run()` → tier pricing + `isBackup` billing + `cbConsent` required check
- [ ] `multipart` handling for file uploads
- [ ] Backup flow: primary `UPSTREAM_DOWN` → return `backupAvailable` + price

### B4. Batches Service

- [ ] Support new types in bulk CSV
- [ ] `multipart` not needed for batches (CSV only)
- [ ] Tier pricing per row

### B5. Wallet & Payments (`apps/api/src/payments`, `wallet`)

- [ ] `StkPayment.method` enum: `stk` | `bank` | `card`
- [ ] Add `BankTransferGateway` (manual confirm via paybill reference)
- [ ] `POST /payments/bank/confirm {paybillRef, amount, phone}`
- [ ] Wallet page: 3 tabs (M-Pesa, Bank, Invoice)
- [ ] Paybill constants: `PAYBILL_NUMBER=880100`, `PAYBILL_ACCOUNT=8402250011`

### B6. Admin Controller (`apps/api/src/admin`)

- [ ] Fix `@Param('status')` → `@Query('status')`
- [ ] `GET /admin/products` — list all types + active + tiers
- [ ] `POST /admin/products/:type/active {active}` — platformAdmin only
- [ ] `POST /admin/pricing/tiers` bulk upsert (platformAdmin)
- [ ] `GET /admin/pricing/tiers?type=` — fetch tiers for type

---

## Phase C — Dashboard UI (Days 3-4)

### C1. Console Verification Page

- [ ] Product picker: 24 cards grouped by category
- [ ] Each card shows `KES unit / backup` + `(VAT Exclusive)` + Active/Inactive chip
- [ ] Dynamic form fields per type (conditional rendering)
- [ ] CB consent checkbox for CRB/BRS types
- [ ] Backup banner on `failed` with `backupAvailable`
- [ ] `Retry with backup` button → calls with `useBackup:true`

### C2. Bulk Page

- [ ] Support all 24 types in dropdown
- [ ] CSV columns per type (dynamic hint)
- [ ] Tier pricing estimation per row

### C3. History Page

- [ ] Date range, status, type filters
- [ ] Pagination (next/prev + total)
- [ ] Server export buttons: CSV / XLSX / PDF
- [ ] Per-row `Download certificate (PDF)`

### C4. Wallet Page

- [ ] 3 tabs: M-Pesa STK, Bank Transfer, Invoice
- [ ] Bank tab: display NCBA details + copy buttons + `Confirm payment` form
- [ ] Real-time balance badge in sidebar (SWR 30s)

### C5. Admin Page

- [ ] Products table: Type | Label | Active (Switch) | Tiers (expand) | Backup Price | Actions
- [ ] Tier editor inline (min/max/unit/backup)
- [ ] Top-up requests + orgs (existing)

### C6. Shared Components

- [ ] `Switch`, `Skeleton`, `Toast` (sonner), `EmptyState`
- [ ] `lucide-react` icons replacing emoji
- [ ] Collapsible sidebar (`lg` breakpoint)

---

## Phase D — Reporting & Exports (Day 4)

### D1. API Export Services

- [ ] `GET /verifications/export?format=csv|xlsx|pdf&type=&from=&to=&status=` (streaming)
- [ ] `GET /verifications/:id/certificate.pdf` (branded + QR)
- [ ] `GET /verifications/batches/:id/export?format=`
- [ ] `GET /wallet/statement?from=&to=&format=`
- [ ] Use `pdfkit`, `exceljs`, `fast-csv`

### D2. Dashboard Export Hooks

- [ ] History: export buttons call server streams
- [ ] Bulk: results download CSV/XLSX/PDF
- [ ] Wallet: statement export

---

## Phase E — Web Marketing + DESIGN.md (Day 5)

### E1. DESIGN.md

- [ ] Tokens: navy `#0A1628`, teal `#00D9B5`, slate scales, radius 8, Manrope/Spline Sans/Inter, light mode, spacing 4/8/16, WCAG AA, 150ms motion
- [ ] Components: Card, Button (primary/secondary/ghost/danger), Badge, Input, Select, Dialog, Toast, Skeleton, EmptyState
- [ ] Layout: sidebar, header, container, grid

### E2. Web App

- [ ] `lib/products.tsx` → 24 products with slugs, categories
- [ ] `/products/[slug]` pages for all 24
- [ ] `/pricing` page: dynamic tier tables from `GET /verifications/products` + bank details
- [ ] Contact, About, Privacy, Terms (existing)

---

## Phase F — Hardening, Tests, CI (Day 5-6)

### F1. Security & Config

- [ ] Fail-fast config: throw if `JWT_SECRET`/`FIELD_ENCRYPTION_KEY`/`DATABASE_URL` missing in production
- [ ] `normalizeKePhone` util (single source)
- [ ] `encryptField` → `v1:` prefix + backward-compatible decrypt
- [ ] `eslint.config.mjs`: `no-console: warn`, `no-explicit-any: warn`

### F2. Unit Tests

- [ ] `packages/providers/test/providers.spec.ts` — all 24 types determinism
- [ ] `apps/api/test/pricing.spec.ts` — tier lookup, calendar month, backup billing
- [ ] `apps/api/test/wallet.spec.ts` — multi-rail, bank confirm

### F3. E2E Tests

- [ ] `e2e/dashboard.spec.ts` extended: register → verify each type → backup retry → bulk → wallet M-Pesa mock → bank confirm mock → exports
- [ ] `e2e/billing.spec.ts` — tier transition at 501st verification
- [ ] `e2e/exports.spec.ts` — CSV/XLSX/PDF download

### F4. CI Gates

- [ ] `pnpm -w build && pnpm -w lint && pnpm -w typecheck && pnpm -w test`
- [ ] Playwright chromium against running stack

---

## Deployment Notes

- `docker-compose.prod.yml`: add `PAYBILL_NUMBER`, `PAYBILL_ACCOUNT` build args
- `Dockerfile.next`: pass `NEXT_PUBLIC_API_URL` build arg
- Prod migration: `prisma migrate deploy` (never `migrate dev`)
- `FIELD_ENCRYPTION_KEY` rotation: requires `v1:` prefix migration script

---

## Acceptance Criteria

1. All 24 products verifiable via `POST /v1/verifications` with correct request/response shapes
2. Tier pricing applies at exact PDF bands; backup charges only on explicit toggle
3. Admin toggles product active → instantly hidden on dashboard + API 400
4. M-Pesa STK + Bank Paybill + Invoice all credit wallet
5. Exports (CSV/XLSX/PDF) open correctly with decrypted data
6. All quality gates pass: lint, typecheck, unit, e2e
7. Docker compose prod stack boots healthy

---

## File Index (for implementation reference)

| Area                | Files to Modify/Create                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema              | `packages/database/prisma/schema.prisma`, `packages/database/prisma/tier-seed.ts`                                                              |
| Types               | `packages/types/src/index.ts`                                                                                                                  |
| Providers           | `packages/providers/src/{provider,mock.provider,aggregator.adapter,registry}.ts`                                                               |
| API Verifications   | `apps/api/src/verifications/{dto,bulk.dto,verifications.service,batches.service,verifications.controller}.ts`                                  |
| API Wallet/Payments | `apps/api/src/payments/{gateway,payments.service,payments.controller}.ts`, `apps/api/src/wallet/*`                                             |
| API Admin           | `apps/api/src/admin/admin.controller.ts`                                                                                                       |
| Dashboard           | `apps/dashboard/src/app/console/{page,bulk,history,wallet,keys}/page.tsx`, `apps/dashboard/src/app/admin/page.tsx`, `apps/dashboard/src/lib/*` |
| Exports             | `apps/api/src/verifications/exports/*.ts`                                                                                                      |
| Web                 | `apps/web/src/lib/products.tsx`, `apps/web/src/app/{products,pricing}/*.tsx`                                                                   |
| Design              | `DESIGN.md` (root + `docs/`)                                                                                                                   |
| Tests               | `packages/providers/test/*.spec.ts`, `apps/api/test/*.spec.ts`, `e2e/*.spec.ts`                                                                |
