# AGENTS.md

Fleek IPRS — identity verification platform (Kenyan IPRS/KRA/phone/SIM-swap + 24 SPIN Kenya products).

Monorepo: pnpm workspaces + Turborepo, Node ≥ 22, TypeScript strict.

## Commands

```bash
pnpm install
pnpm -w build                            # ALWAYS first from clean checkout or after touching packages/* or prisma schema
pnpm -w lint && pnpm -w typecheck && pnpm -w test   # quality gates, same order as CI
pnpm exec playwright test --workers=1     # E2E (see prerequisites below; --workers=1 required on small/low-memory machines)
```

- Run one package: `pnpm --filter @fleek/api <script>` (names: `@fleek/{web,dashboard,api,types,providers,database,ui}`).
- Unit tests (Vitest) exist only in `apps/api` and `packages/providers`.
- API runs **from compiled output**: `node apps/api/dist/main.js`. Use `scripts/start-api.sh` / `scripts/start-dashboard.sh` — detached, idempotent, logs+pids under `/tmp/opencode/`.

## E2E prerequisites

Playwright has **no webServer config** and retries=0 — all services must already be up:

1. `docker compose up -d postgres`
2. `pnpm -w build && pnpm --filter @fleek/database exec prisma migrate deploy && pnpm --filter @fleek/database seed` (seed is idempotent — safe to re-run against a seeded DB)
3. API on :4000 (`scripts/start-api.sh`) and dashboard on :3001 (`scripts/start-dashboard.sh`)

Targets `http://localhost:3001` (dashboard), chromium only. CI (`.github/workflows/ci.yml`) shows the canonical boot order.

## Layout & boundaries

| Path                 | Role                                                                     |
| -------------------- | ------------------------------------------------------------------------ |
| `apps/web`           | Marketing site, Next.js App Router, port 3000                            |
| `apps/dashboard`     | Client console + admin panel, Next.js, port 3001                         |
| `apps/api`           | NestJS REST API, global prefix `/v1`, OpenAPI at `/docs`, port 4000      |
| `packages/types`     | Shared verification product/result types — the cross-app contract        |
| `packages/providers` | `VerificationProvider` interface; `MockProvider` = deterministic sandbox |
| `packages/database`  | Prisma schema/client + field-level AES-256-GCM encryption                |
| `packages/ui`        | Shared UI components (Button, Card, Badge, Input, Label, StatCard)       |

API loads `apps/api/.env` via dotenv at boot; needs `DATABASE_URL`, `JWT_SECRET`, `FIELD_ENCRYPTION_KEY` or it won't start (see `apps/api/.env.example`).

## Verification Products (24)

**Identity — Standard** (5): `iprs_standard`, `match_id_phone`, `employer_verification`, `face_id_match`, `bank_account_verification`
**Identity — Premium** (3): `alien_id`, `aml_pep_screen`, `passport_check`
**Utility** (4): `sim_swap_check`, `kplc_location_checker`, `kra_pin_verification`, `search_name_by_phone`
**Identity & CRB** (1): `search_phones_by_id`
**Vehicle** (2): `motor_vehicle_ownership`, `drivers_license_verification`
**Credit Reference — Metropol** (3): `metropol_score_only`, `metropol_standard_report`, `metropol_full_report`
**Credit Reference — CreditInfo** (3): `creditinfo_score_only`, `creditinfo_comprehensive`, `creditinfo_crb_status`
**KYB** (1): `brs`
**Analytics** (2): `spin_score_only`, `scanned_statement`

## Tiered Pricing (PDF-exact, VAT-exclusive)

Volume bands: `0-500`, `501-2500`, `2501-5000`, `5001-10000`, `10001-30000`, `30001+`

- SPIN Score uses special bands: `1-1000`, `1001-5000`, `5001-10000`, `10001-20000`, `20001-50000`, `50000-100000`
- Identity Standard: 30/28/26/24/22/20 (backup: 45/43/42/38/34/32)
- Utility: 20/18/16/14/12/10
- Backup rates apply only on **explicit user toggle** after primary `UPSTREAM_DOWN`
- Calendar-month volume via `OrganizationMonthlyUsage` (resets 1st EAT)

## Key API Endpoints

```
POST   /v1/verifications              # Run verification (supports all 24 types, multipart for files)
GET    /v1/verifications/products     # List products with current tier pricing + backup availability
GET    /v1/verifications              # History with filters + pagination
GET    /v1/verifications/:id          # Detail (decrypted result)
GET    /v1/verifications/batches      # Bulk CSV operations
POST   /v1/payments/stk               # M-Pesa STK push
POST   /v1/payments/bank/confirm      # Bank/Paybill manual confirm
GET    /v1/payments/bank-details      # NCBA 8402250011 / Paybill 880100
GET    /v1/exports/verifications      # CSV/XLSX/PDF export
GET    /v1/exports/verifications/batch/:id
GET    /v1/exports/wallet/statement
GET    /v1/verifications/:id/certificate  # PDF certificate
GET/PUT /admin/products/:type/active    # Live product gating (platformAdmin only)
GET/POST/PUT /admin/pricing/tiers       # Full tier CRUD
GET/PUT /admin/organizations/:id/enabled-checks  # Enable/disable verification types per org
GET/POST/PUT /admin/organizations/:id/pricing-tiers # Org-level pricing overrides
```

## Key DTOs (`apps/api/src/verifications/dto.ts`)

`RunVerificationDto` — all 24 types + optional fields:

- `idNumber`, `kraPin`, `phoneNumber`, `alienId`, `passportNumber`, `nationality`
- `bankCode`, `accountNumber`, `employerName`, `meterNumber`, `vehicleRegNumber`, `dlNumber`
- `businessRegNumber`, `faceImageBase64`, `statementPages`, `statementFileBase64`
- `cbConsent` (required for Metropol, CreditInfo, BRS, Motor Vehicle)
- `useBackup` (explicit backup toggle), `consent`, `consentCollectedBy`

## Environment Variables (API)

Required: `DATABASE_URL`, `JWT_SECRET`, `FIELD_ENCRYPTION_KEY`
Optional: `USE_LIVE_UPSTREAM`, `UPSTREAM_BASE_URL`, `UPSTREAM_API_KEY`, `LIVE_CHECKS`
Backup: `BACKUP_BASE_URL`, `BACKUP_API_KEY`, `BACKUP_CHECKS`
Payments: `DARAJA_*`, `PAYBILL_NUMBER=880100`, `PAYBILL_ACCOUNT=8402250011`, `BANK_NAME=NCBA`, `BANK_BRANCH=Uphill`, `ACCOUNT_NAME=SPIN MOBILE LIMITED`
Frontend: `NEXT_PUBLIC_API_URL` (inlined at build), `NEXT_PUBLIC_APP_URL`

## Providers & Backup Routing

`ProviderRegistry` at `packages/providers/src/registry.ts`:

- `enabledTypes` — which checks exist at all
- `primaryProvider` — main live upstream (AggregatorAdapter)
- `backupProvider` — fallback upstream
- `liveTypes` — which checks route to primary
- `backupTypes` — which checks have backup available
- `resolve(type, useBackup?)` — returns provider; `useBackup=true` hits backup
- `hasBackup(type)` — check if backup available
- `isLive(type)` — check if primary live

MockProvider is deterministic (FNV-1a hash) — same input = same output.
AggregatorAdapter expects SPIN-compatible endpoints under `/kenya/*`.

## Gotchas

- **`NEXT_PUBLIC_*` is inlined at build time.** Changing runtime env does nothing for built frontends. In Docker they are build args (`Dockerfile.next`, `APP` arg selects web/dashboard); on Vercel they are project env vars set before build.
- **Rotating `FIELD_ENCRYPTION_KEY` silently breaks decryption** (key derived via sha256). v1 prefix added (`v1:iv:tag:data`) — decrypt handles legacy format. Don't rotate casually.
- Every third-party integration is credential-gated: empty env vars ⇒ sandbox/mock behavior (deterministic MockProvider; M-Pesa mock gateway auto-completes ~3s). Never hardcode credentials or assume a real upstream exists.
- Verifications require `consent` + `consentCollectedBy`; results PII encrypted at rest and **must never appear in logs** (Kenya DPA compliance).
- **CB consent required** for Metropol, CreditInfo, BRS, Motor Vehicle — `cbConsent: true` in DTO.
- **Backup is explicit opt-in** — no silent surcharge. On `UPSTREAM_DOWN` API returns `backupAvailable: true, backupPrice`; user clicks "Retry with backup".
- **File uploads** via `multipart/form-data` for `face_id_match` (image), `scanned_statement` (PDF), `brs` (PDF).
- **Calendar-month volume** — `OrganizationMonthlyUsage` keyed by `orgId`, `month` (`2026-08`), `productType`.
- ESLint: one flat config at root; `no-explicit-any: warn`, `no-console: warn`, unused vars ignore `_` prefix.
- Seeded platform admin: `admin@fleektech.co.ke` / `Admin123!` (re-seeding resets this password); new orgs get KES 5,000 credit.
- **Fail-fast config** — throws if `JWT_SECRET`/`FIELD_ENCRYPTION_KEY`/`DATABASE_URL` missing in production (no dev fallbacks).
- `normalizeKePhone` utility in `apps/api/src/common/phone.ts` — single source for phone formatting.

## Dashboard Build Blocker

Dashboard uses Next.js 14.2.33 but requires `@next/swc-linux-x64-gnu@14.2.33` binary. Network issues prevent pnpm install of correct binary. Workaround when network available:

```bash
cd apps/dashboard && pnpm add -D @next/swx-linux-x64-gnu@14.2.33
NEXT_IGNORE_INCORRECT_LOCKFILE=1 pnpm build
```

## Docker Images

Both Dockerfiles encode fixes from a crash-loop incident — don't simplify them back:

- Deps stage copies **every** workspace `package.json` + lockfile + `.npmrc` before install. A partial set goes stale when `COPY . .` adds the rest → pnpm runs an implicit reinstall mid-build that dies on registry timeouts.
- Installs use a pnpm store cache mount; fetch retries/timeouts live in `/root/.npmrc` inside the image (pnpm ignores uppercase `NPM_CONFIG_*` env vars).
- api runner copies root `node_modules` **plus** per-package `node_modules` and internal package roots (`dist/` + `package.json`). pnpm resolves workspace deps via relative symlinks — missing any piece ⇒ runtime `MODULE_NOT_FOUND` (`dotenv`, `@fleek/database`, …). The Prisma schema dir is copied for one-off migrations.
- openssl must be installed **before** `pnpm install` / `prisma generate`, else Prisma's platform detection bakes OpenSSL-1.1 engines that fail at runtime. That's why api is `bookworm-slim`; `Dockerfile.next` stays alpine (Next standalone has no native engines).
- `Dockerfile.next`: `${APP}` in CMD expands at _runtime_ — the ARG must be re-exported as ENV.

## Deployment

Two targets coexist:

- **Self-hosted prod** (api.fleekiprs.co.ke + currently all domains): Docker Compose project `fleek-iprs-prod` driven by `./deploy/deploy.sh` (`deploy.sh tls` issues certs). nginx configs in `deploy/nginx/`; `nginx/` holds runtime TLS certs/webroot and is gitignored. API runs with `TRUST_PROXY=true` behind nginx. Prod migrations = `prisma migrate deploy` (never `migrate dev`); manual one-off: `docker compose -p fleek-iprs-prod -f docker-compose.prod.yml run --rm api node packages/database/node_modules/prisma/build/index.js migrate deploy --schema packages/database/prisma/schema.prisma`. See `deploy/DEPLOYMENT.md`.
- **Vercel hosts both frontends** (`iprs-web`, `iprs-dashboard` projects): monorepo setup with `rootDirectory=apps/<app>` set per project plus per-app `vercel.json` (`framework: nextjs`). Deploy via CLI prebuilt flow **from repo root** (linking inside an app dir breaks uploads — build traces reference files above the app directory).

## Git

CI gates every push to `main` and PRs; direct pushes to `main` are the current norm.

## Recent Fixes (verified)

- All workspace `pnpm -w typecheck` passes (10/10 packages)
- All workspace `pnpm -w lint` passes with 0 errors (3 warnings in API only, pre-existing)
- Admin org UI implemented: `GET/PUT /admin/organizations/:id/enabled-checks` and `GET/POST/PUT /admin/organizations/:id/pricing-tiers`
- Provider test spec fixed: corrected method names and enum references (removed stale test, fixed `iprsIdLookup` → `iprsStandardLookup`, `IPRS_ID` → `IPRS_STANDARD`)
- API `selectTierInMemory` static method added to `verifications.service.ts` for in-memory tier selection
- API payments gateway lint fixes: removed unused variables, prefixed unused params
- Dashboard console lint fixes: removed unused imports
- Web pricing page lint fix: removed unused import
- Fixed `packages/providers/test/providers.spec.ts` test syntax (`it 'single-quote'` → `it("double-quote")`)

## Architecture

This is a credential-gated monorepo: all third-party integrations are disabled by default. Empty env vars ⇒ sandbox/mock behavior. Real services activate by configuration only. The `ProviderRegistry` in `packages/providers` routes each verification type to live upstream, backup provider, or the deterministic `MockProvider` based on `ENABLED_CHECKS`, `LIVE_CHECKS`, and `BACKUP_CHECKS` env vars.

Field-level AES-256-GCM encryption via Prisma means rotating `FIELD_ENCRYPTION_KEY` silently breaks decryption of existing data (key format: `v1:iv:tag:data`). The `ProviderError` codes (`NOT_FOUND`, `UPSTREAM_DOWN`, `INVALID_INPUT`, `UNKNOWN`) map upstream HTTP statuses consistently.

CB consent is required for 8 verification types (Metropol, CreditInfo, BRS, Motor Vehicle). Backup is an explicit opt-in — the API returns `backupAvailable: true, backupPrice` on primary failure; user must click "Retry with backup" to activate.

No other API keys (ANTHROPIC, OPENAI, etc.) are read. If Gemini semantic extraction is needed, set `GEMINI_API_KEY` or `GOOGLE_API_KEY`.

## Compliance posture (Kenya DPA 2019)

- Explicit consent + collector recorded on every verification
- PII results encrypted at rest (AES-256-GCM field-level)
- Role-based access control, full audit log, no PII in logs

## Roadmap

M-Pesa Daraja wallet top-ups · CRB checks · KYB (business registry) · face match + liveness ·
bulk CSV verification runs · live NRB/aggregator adapters.

© 2026 Fleektech LTD
