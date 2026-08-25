# Fleek IPRS

[![CI](https://github.com/fleektech/fleek-iprs/actions/workflows/ci.yml/badge.svg)](https://github.com/fleektech/fleek-iprs/actions/workflows/ci.yml)

**Instant identity verification for Africa — by [Fleektech LTD](https://fleektech.co.ke)**

Fleek IPRS gives lenders, SACCOs, banks and fintechs real-time identity verification against
IPRS (Kenya's Integrated Population Registration System), KRA, telecom subscriber records and
mobile-money KYC — through one clean REST API and an operator-friendly dashboard.

## Monorepo layout

| Path | What it is | Dev URL |
|---|---|---|
| `apps/web` | Public marketing site + developer portal | http://localhost:3000 |
| `apps/dashboard` | Client console: verifications, wallet, API keys, admin | http://localhost:3001 |
| `apps/api` | NestJS REST API (`/v1`) with OpenAPI docs at `/docs` | http://localhost:4000 |
| `packages/types` | Shared domain types (verification products & results) | — |
| `packages/providers` | Pluggable verification provider layer + deterministic mock | — |
| `packages/database` | Prisma schema, client, field-level AES-256 encryption helpers | — |
| `packages/ui` | Brand kit & shared UI components (navy `#0A1628` / teal `#00D9B5`) | — |

## Quick start (local dev)

```bash
pnpm install
docker compose up -d postgres          # local Postgres 16
cp apps/api/.env.example apps/api/.env
pnpm -w build                          # builds shared packages first
pnpm -w db:migrate                     # prisma migrate dev
pnpm -w db:seed                        # demo org + pricing
scripts/start-api.sh                   # :4000
scripts/start-dashboard.sh             # :3001
scripts/start-web.sh                   # :3000 (optional)
```

Seeded platform admin: `admin@fleektech.co.ke` / `Admin123!`

New sign-ups receive **KES 5,000 welcome credit**; further credit is by invoice
(an admin approves top-up requests).

## Verification products (v1)

- **IPRS ID Verification** — national ID → names, DOB, photo fields, serial, alive status
- **KRA PIN Checker** — PIN validity, taxpayer status
- **Hakikisha / Phone Check** — ownership + M-Pesa KYC match
- **SIM-swap Detection** — last swap date + risk level

All results come from the pluggable provider layer. v1 ships a **deterministic MockProvider**
(same input → same output) that doubles as the sandbox; real upstream adapters implement the same
interface in `packages/providers/src/provider.ts`.

## API quickstart

```bash
curl -X POST https://api.fleekiprs.co.ke/v1/verifications \
  -H "Authorization: Bearer flk_test_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"iprs_id","idNumber":"12345678","consent":true,"consentCollectedBy":"Acme Ltd"}'
```

Interactive OpenAPI reference: `http://localhost:4000/docs`

## Testing & quality gates

```bash
pnpm -w lint        # ESLint across the workspace
pnpm -w typecheck   # tsc --noEmit per package/app
pnpm -w test        # Vitest unit tests (providers, DTOs)
pnpm exec playwright test   # E2E: register → verify → result (needs services running)
```

CI (`.github/workflows/ci.yml`) runs all four gates on every push/PR, plus a full E2E job
that boots Postgres → API → dashboard and exercises the happy path in a real browser.

## Deployment

- `docker-compose.prod.yml` — Postgres + api + web + dashboard behind one compose project.
- `apps/api/Dockerfile` — multi-stage NestJS image (runs migrations with `prisma migrate deploy`).
- `Dockerfile.next` — standalone-output Next.js image used for both web and dashboard via `APP` arg.

Required production env (see `.env.example`s): `DATABASE_URL`, `JWT_SECRET`, `FIELD_ENCRYPTION_KEY`,
`CORS_ORIGINS`, `ENABLED_CHECKS`, `NEXT_PUBLIC_API_URL`.

## Compliance posture (Kenya DPA 2019)

- Explicit consent + collector recorded on every verification
- PII results encrypted at rest (AES-256-GCM field-level)
- Role-based access control, full audit log, no PII in logs

## Roadmap

M-Pesa Daraja wallet top-ups · CRB checks · KYB (business registry) · face match + liveness ·
bulk CSV verification runs · live NRB/aggregator adapters.

© 2026 Fleektech LTD
