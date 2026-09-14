# Fleek IPRS — Improvement Program + Logo Rollout (Approved Spec)

**Date:** 2026-09-14 · **Status:** Approved for build · **Priority:** Balanced quick wins first
**Scope:** Track 0 (logo rollout) + Phase 1 (close the hole, stop the bleeding). Phases 2–4 planned, deferred.

## 1. Decisions (locked)

- Phasing: balanced quick wins; cross-org overwrite fix rides in Phase 1.
- Logo: shield mark + `Fleek IPRS` wordmark lockup everywhere. No rebrand; product/legal/DPA copy untouched.
- Palette: gradient accents shift to logo blue→cyan (`#2F9DFF → #38E1FF`, verify against asset at implementation); teal reserved for success/info semantics only.
- Source asset: repo-root `transparent-logo.png` (861×865 RGBA full lockup on transparency; **white wordmark ⇒ dark surfaces only**). Committed as source of truth.

## 2. Track 0 — Logo rollout (parallel track, ships first)

### 2.1 Assets (derived once, committed)
- `brand/mark.png`: shield-mark crop of `transparent-logo.png` (≈ x 22–80%, y 2–60%; verify visually). Light surfaces, favicons, PDF.
- `brand/lockup-dark.png`: full transparent file as-is. Dark surfaces only.
- Favicons 16/32/48, `apple-touch-icon.png` (180, navy-backed — Apple ignores transparency), manifest icons 192/512 (+ maskable), web `og.png` (1200×630, lockup on navy).
- Files live in `apps/web/public/brand/` + `apps/dashboard/public/brand/` (Next serves per-app `public`; standalone Docker picks it up). Root PNGs + crop-note README are source of truth.

### 2.2 Shared component — `BrandMark` in `packages/ui`
- Props: `variant: 'mark' | 'lockup'`, standard sizes, `next/image`, meaningful alt, fixed aspect ratios (no CLS).
- Both apps consume it; no per-app logo re-implementation.

### 2.3 Surfaces
| Surface | Change |
|---|---|
| Web header (light) | mark h-8 + `Fleek IPRS` display text (`site-chrome.tsx`) |
| Web footer (navy) | full lockup + existing columns |
| Web `layout.tsx` | `icons`, `manifest`, `openGraph`/`twitter` (reuses `metadataBase`) |
| Dashboard desktop rail (navy) | true-color mark in tile; subtitle → `Identity. Verification. Intelligence.` |
| Collapsed rail + mobile top bar (light) | mark inside existing navy tile (zero layout change) |
| Auth pages (navy bg) | full lockup above card |
| Dashboard `layout.tsx` | `icons` + `manifest` |
| PDF certificate + export header (`export.service.ts`) | embed `mark.png` via PDFKit, text fallback if asset missing; API Dockerfile copies asset |
| Emails / Swagger / Daraja | **No change** (plaintext / functional surfaces; HTML mail is a separate project) |

### 2.4 Palette tokens
- `.brand-gradient-text` (`globals.css`) + Tailwind navy/teal scale → blue-cyan gradient; teal stays for success badges only. Snapshot-review all surfaces after swap.

### 2.5 Verify
Visual pass light/dark at 320px→desktop; favicon/OG validators; PDF render check; `pnpm -w lint/typecheck/test/build` green.

## 3. Phase 1 — Close the hole + stop the bleeding

### 3.1 Cross-org tier overwrite (security hole)
- **Root cause:** `PUT /admin/organizations/:id/pricing-tiers/:tierId` (`admin.controller.ts:438`) updates `where: { id: tierId }` without verifying the tier belongs to `targetOrgId`. A guessed UUID allows cross-org price overwrite.
- **Fix (TDD):** failing test first (foreign tier UUID ⇒ 403/404, own tier ⇒ 200), then scope-check (`findFirst({ where: { id: tierId, orgId: targetOrgId } })` before update).
- **Verify:** regression test + full gates.

### 3.2 SPIN tier bands (billing correctness)
- **Root cause:** `tier-seed.ts:533-573` — gap at volume 0 (first `minVolume: 1` ⇒ new orgs 400 `No pricing tier configured`), overlap at 50000 (two rows match; `orderBy minVolume desc` picks arbitrarily), closed top (`maxVolume: 100000` ⇒ volume >100k unbilled).
- **Fix (TDD):** backfill migration (`0–1000` first band, de-overlap 50000 boundary, open-ended top `null`); `run()`/`products()` null-tier guard with priced fallback instead of 400/`unitPriceKes: null`.
- **Verify:** pricing tests at volumes 0 / 50000 / 100001; repro script; gates.

### 3.3 Liveness vs readiness
- **Root cause:** `GET /v1/health` returns static `{ok}` with no DB check — Render health check + compose `depends_on` pass with DB down.
- **Fix:** keep `/v1/health` (liveness); add DB-checking readiness endpoint; point `render.yaml` health check + compose `depends_on: service_healthy` at readiness.
- **Verify:** readiness fails with DB down, passes with DB up.

### 3.4 E2E on PRs
- **Root cause:** E2E + frontend builds gated `if: github.ref == 'refs/heads/main'` (`ci.yml:64,114,133`) — PRs skip integration entirely.
- **Fix:** run E2E on PRs (keep `--workers=1`); keep heavy main-only builds as-is.
- **Verify:** CI config review + one PR run.

## 4. Phases 2–4 (planned, deferred)
- **Phase 2 — Billing truth:** atomic volume-read/charge/increment (row lock or serializable retry); backup honesty (charge what actually served; price only when `hasBackup()`); `scanned_statement` formula-vs-copy resolution; batch estimate parity + `cbConsent`/`useBackup` handling.
- **Phase 3 — Integration + frontend consistency:** `AnyAuthGuard` on read/history/batch/export routes; shared dashboard helpers (currency/status/humanise/mask); fake-disabled-Link fix; CSV whitespace + export-race fixes; tier contiguity validation; guard/csv/helper specs; batch/API-key/multipart E2E.
- **Phase 4 — Durability & ops:** persistent batch queue; key versioning/rotation; `AuditLog` for mutations; alerting + request IDs; reproducible Docker builds; Postgres decision; committed `.env` cleanup; backup/restore drills.

## 5. Out of scope
Live upstream adapters (wire credentials, don't rewrite), HTML mail, marketing-site tests, UI redesign.

## 6. Global gates (every phase)
`pnpm -w lint && pnpm -w typecheck && pnpm -w test && pnpm -w build`, repro scripts where applicable, commit + push + Vercel deploy verify.
