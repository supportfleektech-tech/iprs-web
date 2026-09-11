# Fleek IPRS — Design Specification

**Date:** 2026-08-25
**Company:** Fleektech LTD (fleektech.co.ke)
**Product:** Fleek IPRS — identity verification & intelligence platform
**Status:** Approved

## 1. Overview

Fleek IPRS is a full-stack identity verification platform for Kenyan (and later African) financial institutions, lenders, SACCOs and fintechs. Clients sign up on a dashboard, top up their wallet (manual invoice flow in v1), and run identity verifications either from the dashboard console or programmatically via a REST API.

Reference competitor: spinmobile.co (same service category; independent branding/design).

## 2. Scope

Three applications plus shared packages:

| App              | Domain              | Purpose                                  |
| ---------------- | ------------------- | ---------------------------------------- |
| `apps/web`       | fleekiprs.co.ke     | Public marketing site                    |
| `apps/dashboard` | app.fleekiprs.co.ke | Client portal + admin panel              |
| `apps/api`       | api.fleekiprs.co.ke | REST API powering dashboard & public API |

Shared packages: `packages/ui`, `packages/database` (Prisma), `packages/providers`, `packages/types`.

## 3. Verification Products (v1)

1. **IPRS ID Verification** — input: national ID number → output: full name, DOB, gender, photo, serial number, etc.
2. **KRA PIN Checker** — input: KRA PIN or ID → output: PIN validity, tax compliance status.
3. **Hakikisha / Phone Check** — input: phone number or ID → output: registered owner name(s), numbers linked to ID.
4. **SIM-swap Detection** — input: phone number → output: last swap date, risk level.
   _(M-Pesa KYC match ships with the phone check family.)_

## 4. Data Sources

v1 uses a **pluggable provider abstraction** with a deterministic `MockProvider`. Real upstream adapters (NRB direct or aggregators) implement the same interface later:

```ts
interface VerificationProvider {
  iprsIdLookup(idNumber: string): Promise<IprsResult>;
  kraPinCheck(input: KraInput): Promise<KraResult>;
  phoneOwnership(input: PhoneInput): Promise<PhoneResult>;
  simSwapCheck(phone: string): Promise<SimSwapResult>;
}
```

Each product has an enable flag so checks go live independently.

## 5. Architecture

- **Monorepo:** pnpm workspaces + Turborepo. TypeScript strict everywhere.
- **API:** NestJS, REST under `/v1`, OpenAPI generated, Bearer API keys (`flk_live_`/`flk_test_`, hashed at rest) for machine access; JWT access+refresh for dashboard sessions.
- **Web apps:** Next.js 14 App Router, Tailwind CSS, shadcn/ui primitives via `packages/ui`.
- **Database:** PostgreSQL 16 + Prisma ORM.
- **Tooling:** ESLint + Prettier, Vitest (unit), Playwright (e2e), Docker Compose for local Postgres.

## 6. Data Model

- `Organization` (name, status) → many `User` (roles: OWNER/ADMIN/MEMBER)
- `ApiKey` (org-scoped, hashed key, env live/test, lastUsedAt)
- `Wallet` (org-scoped balance, minor units) → `Transaction` ledger (topup/charge/refund)
- `TopUpRequest` (amount, status pending/approved/rejected, admin note)
- `VerificationRequest` (type, encrypted input/result JSONB, status, cost, latencyMs, source dashboard|api, consent fields)
- `ProductPricing` (per-product price, active flag)
- `AuditLog` (actor, action, entity, metadata)

## 7. Dashboard Features

- Auth: register (creates org+owner), login, JWT session
- Verifications console: product picker → form → result card; history w/ filters + CSV export
- Wallet: balance, request top-up, ledger
- API keys: create/revoke, env toggle, last used
- Admin panel (OWNER/ADMIN): approve/reject top-ups, manage users, set pricing, global transactions
- Sandbox/live toggle: sandbox routes to MockProvider at zero cost

## 8. Marketing Site

Home (hero with live-verify animation, stats, clients marquee, why-us grid, sectors, testimonials, CTA), Products hub + one page per product ("You provide / We return" pattern), Developers overview linking to docs, About, Contact (persisted to DB), Blog (MDX-ready stub), Privacy/Terms/DSA notice pages. SEO: metadata API, OG images, sitemap, robots.txt.

## 9. Docs Portal

Served from marketing site `/developers/docs`: OpenAPI-derived endpoint reference + MDX quickstart guides (curl / Node / Python).

## 10. Security & Compliance

Kenya Data Protection Act 2019 posture: explicit consent fields captured per verification, field-level AES-256 encryption of PII results at rest, TLS, RBAC, audit logging, no PII in logs, secrets via environment variables only.

## 11. Billing Model

Manual/invoice top-ups in v1: client requests credit → admin approves → wallet credited. Per-check pricing deducted per successful verification. No online payment gateway in v1 (M-Pesa Daraja adapter is a future phase).

## 12. Testing

- Unit (Vitest): providers (mock fixtures), pricing/wallet math, auth guards
- E2E (Playwright): signup → login → verify → history export; contact form
- All packages/apps pass lint + typecheck

## 13. Delivery Phases

0. Repo init, spec, scaffold
1. Brand kit + shared UI
2. Database + API core
3. Dashboard
4. Marketing site + docs
5. E2E, polish, deployment configs
