# Fleek IPRS Dashboard and Admin Experience

**Date:** 2026-09-09  
**Status:** Approved for implementation by user direction  
**Product:** Fleek IPRS identity verification console and administration portal  
**Audience:** Organization owners, administrators, operations staff, and platform administrators

## 1. Experience Direction

The dashboard should feel like a trusted identity-operations control room, not a generic SaaS template. It will use a calm light workspace with a deep navy command rail, a restrained teal and cyan accent system, high-contrast typography, dense data tables, and subtle state-aware motion. The design prioritizes speed, trust, clarity, and operational control.

The visual system is intentionally restrained: no decorative gradients as page backgrounds, no emoji icons, no oversized marketing language inside the console, and no color-only status indicators. Productivity and compliance cues come from clear labels, status chips, icons, and precise hierarchy.

## 2. Core Layout

- A persistent left command rail on desktop with the Fleek IPRS mark, primary navigation, workspace context, and account actions.
- A collapsible rail on tablet and a top navigation bar on mobile, with the same destinations reachable by keyboard and touch.
- A sticky page header containing the page title, contextual actions, and a compact workspace/date/status summary.
- A maximum-width content canvas with 24px desktop gutters, 16px tablet gutters, and 16px mobile gutters.
- Cards use a consistent 16px/20px radius system, 1px borders, and restrained elevation only where a card needs to sit above a surface.
- Tables use fixed semantic columns, sticky headers where needed, tabular numerals, wrapping identifiers, and clear empty/loading/error states.

## 3. Visual Tokens

- Background: warm off-white `#F6F8FB`.
- Surface: white `#FFFFFF`.
- Primary text: navy `#0A1628`.
- Secondary text: slate `#5B6472`.
- Border: slate `#DCE3EC`.
- Accent: teal `#00B89A` for actions and positive states.
- Focus: cyan `#0891B2` with a visible 2-3px ring.
- Warning: amber `#B45309`; danger: red `#B42318`; info: blue `#1D4ED8`.
- Display type: Space Grotesk or a project-approved system display stack; body type: Inter or a project-approved system sans stack.
- Motion tokens: 150-250ms for state changes, transform/opacity only, and a reduced-motion fallback.

## 4. Page Architecture

### Overview

The console landing page becomes the operational overview. It shows:

- Available wallet balance and recent wallet movement.
- Verification volume, success rate, and current month usage.
- Recent verifications with status and product.
- Product availability and quick actions.
- A compact activity strip or chart based on available API data.

The overview is the default destination after login and must remain useful with no records.

### Verify

The verification page becomes a product-first workspace:

- Group all 24 products by category with active/inactive and pricing indicators.
- Selecting a product reveals a focused form, required-field guidance, consent requirements, file-upload support, and backup availability.
- The primary action is always visible and disabled until required input is present.
- Results render as a structured evidence panel, not a raw JSON dump, with sensitive image fields excluded from the normal view.
- Failed primary checks with backup availability get a clear recovery banner and explicit backup price.

### History and Reports

History becomes the reporting workspace:

- Date range, product, status, source, and search filters.
- Sortable columns with `aria-sort`.
- Pagination or explicit limit/offset controls.
- CSV, XLSX, and PDF exports backed by the existing export endpoints.
- Row-level certificate download.
- A compact summary of total cost, latency, and status distribution.

### Wallet

The wallet becomes a financial control surface:

- Balance hero with currency and recent movement.
- M-Pesa, bank, card, PayPal, and invoice rails presented as clearly labeled tabs or sections.
- Payment status, retry/confirmation actions, and visible sandbox/live context.
- Ledger with sign-aware amounts, running balance, and export options.

### Admin

The admin page becomes a platform command center:

- Platform statistics and pending actions in the first viewport.
- Top-up review queue with organization context and inline decision actions.
- Product catalog with active toggles, pricing, backup pricing, consent, and upload indicators.
- Global and organization-specific pricing controls with explicit save and validation states.
- Organization table with balance, user count, enabled checks, and manage actions.
- API-key management with a one-time secret disclosure and revoke state.

## 5. Interaction and Feedback

- Every async action has a loading state, disabled submit control, and success/error feedback near the action.
- Loading uses skeletons or a compact progress indicator for operations expected to take longer than 300ms.
- Empty states explain what to do next; error states include a retry or recovery action.
- Buttons have visible hover, active, focus, and disabled states; touch targets are at least 44px.
- Keyboard focus follows visual order and never disappears.
- Tables and filters expose labels and state to assistive technology.
- Status is conveyed with text plus color and, where useful, an icon.
- Motion is limited to meaningful transitions and respects `prefers-reduced-motion`.

## 6. Data and API Contract

The dashboard will use the existing authenticated API contract:

- `/admin/stats` for overview counts.
- `/verifications/products` for product availability, pricing, consent, and upload metadata.
- `/verifications` for filtered history and totals.
- `/verifications/:id` for evidence detail.
- `/verifications/batches` for bulk progress and results.
- `/wallet`, `/wallet/transactions`, and `/wallet/top-ups` for financial state.
- `/payments/*` for payment rails.
- `/exports/verifications`, `/exports/verifications/batch/:id`, `/exports/wallet/statement`, and `/exports/verifications/:id/certificate` for reports.
- `/admin/*` for platform administration.

Where the existing API lacks a useful aggregate, add a small server-side analytics endpoint rather than fabricating metrics client-side. PII must remain encrypted at rest and must not be written to logs.

## 7. Security and Compliance

- Keep JWT sessions in `localStorage` only if the existing application contract requires it; never expose secrets in source.
- Never log decrypted PII or result payloads.
- Keep consent and CB consent explicit and visible in the relevant forms and evidence records.
- Keep platform-admin endpoints restricted server-side.
- Use semantic labels and accessible error placement.
- Preserve existing API-key revocation and one-time secret behavior.

## 8. Verification Strategy

- Add focused tests for shared formatting, status mapping, filter/export query construction, and any new analytics helper.
- Extend Playwright coverage for login, overview rendering, verification, history filters/exports, wallet loading, and admin rendering where the local stack is available.
- Run the repository gates in the required order: build, lint, typecheck, tests, then Playwright against the running API/dashboard stack.
- Inspect the result at desktop, tablet, mobile, and reduced-motion settings.

**Outcome (2026-09-11, Task 8):** strategy executed end-to-end — build 6/6, lint 0 errors, typecheck 10/10, unit 78+7 passed, Playwright 30/30 green against local postgres + API + dashboard; responsive/keyboard/reduced-motion/loading-empty-error/PII checks all evidenced in `e2e/dashboard.spec.ts` and the plan's Task 8 evidence block. Spec contract holds: consent-gated verify, server-filtered history, 403-enforced platform endpoints, no PII in logs.

## 9. Implementation Boundaries

This plan improves the existing dashboard and admin without changing the monorepo architecture, database model, provider abstraction, or API authentication model. New UI code should be local to `apps/dashboard` unless a shared component is demonstrably needed by multiple apps. API changes should be minimal and documented through the existing OpenAPI conventions.
