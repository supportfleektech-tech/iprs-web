# Task 5 Report — Rebuild wallet and payment workflow

**Base:** `b5a22db`  
**Branch:** (working tree, uncommitted)  
**Date:** 2026-09-10

## Summary

Rebuilt `apps/dashboard/src/app/console/wallet/page.tsx` from stacked payment cards into a financial control surface per spec §4 Wallet and brief task-5. Added wallet hero with balance and export statement actions, activity summary, labeled rail tabs for 5 rails (M-Pesa, bank, card, PayPal, invoice), and ledger with sign-aware amounts, running balance, timestamps, and export links. Created `lib/wallet.ts` pure helpers, `components/wallet-summary.tsx`, and `components/payment-rail.tsx` with semantic labels, 44px targets, explicit loading/error/success, permission messaging, and prefers-reduced-motion support. Corrected bank rail to `GET /payments/bank-details` + `POST /payments/bank/confirm`, retained sandbox/live messaging for all rails, and preserved provider/consent/pricing/export contracts.

## Files Changed

- `apps/dashboard/src/app/console/wallet/page.tsx` — **Modified** — Full rebuild: `WalletHero` + `WalletActivitySummary` at top, `PaymentRailTabs` (5 rails, `role=tablist`/`tab` `aria-selected`/`aria-controls`, `h-11`), conditional `PaymentRail` panels (`role=tabpanel`), 5 preserved flows (M-Pesa `POST /payments/stk` + poll `GET /payments/stk/:id`; bank `GET /payments/bank-details` details card + `POST /payments/bank/confirm` with amount/phone/paybillRef; card `POST /payments/card` / `POST /payments/card/:id/confirm`; PayPal `POST /payments/paypal` / `POST /payments/paypal/:id/capture`; invoice `POST /wallet/top-ups`), each with loading (`aria-busy`, `Waiting for PIN…`/`Processing…`), error (`role=alert`), success (`role=status` teal banner) — sandbox messages preserved (`SANDBOX MODE — … auto-completes in a few seconds` vs live prompts), ledger table (`aria-label="Wallet ledger"`, sign-aware `formatLedgerAmount` green/red, `balanceAfter` running balance, `<time dateTime>` timestamps, `tabular-nums`), export header + statement actions (`buildWalletStatementUrl`→`downloadReport` CSV/PDF), permission banners (global amber status if !canManage + per-rail `View only` chip + dimmed `pointer-events-none opacity-60`), refresh + refresh polling cleanup, `canInitiatePayments` gating (`OWNER`/`ADMIN`), never logs PII.
- `apps/dashboard/src/components/wallet-summary.tsx` — **Created** — `WalletHero({balance,currency,loading,onExportCsv,onExportPdf,exporting})` (navy hero card, `formatWalletBalance`, live ledger badge, CSV/PDF export buttons `h-9`, explainer card) + `WalletActivitySummary({transactions,topUps,loading})` (3 metrics: ledger entries with last credit/debit via `formatLedgerAmount`, top-up requests with pending `Badge amber`, last movement via `formatTimestamp`) + `WalletSummary` composer; sections `aria-label="Wallet balance"`/`"Wallet activity"`, `aria-busy` skeletons.
- `apps/dashboard/src/components/payment-rail.tsx` — **Created** — `PaymentRailTabs({activeRail,onChange,canManage})` (5 buttons `role=tab` `aria-selected`, `h-11`, `border-navy-900 bg-navy-900` active), `PaymentRail({rail,enabled,children})` (`role=tabpanel` `aria-labelledby`, header `CardTitle`+`CardDescription` via `PAYMENT_RAIL_LABELS`/`DESCRIPTIONS`, `View only` chip when !enabled, amber `role=status` permission block, `pointer-events-none opacity-60` when disabled), `RailMessage({message,error})` (teal `role=status`, red `role=alert`), `RAIL_TABS` constant.
- `apps/dashboard/src/lib/wallet.ts` — **Created** — Types `PaymentRailType`, `WalletTransaction`, `WalletTopUp`, `BankDetails`, `WalletPageData{ titanic}`, `PaymentRailProps{rail,balance,enabled,onSuccess?}`, constants `PAYMENT_RAIL_LABELS/DESCRIPTIONS`, `ALL_PAYMENT_RAILS`, helpers `formatKes` (2 decimals `KES 1,234.50`), `formatWalletBalance` (`KES 1,234` / `KES —`), `formatLedgerAmount` (`+KES` green vs `−KES` red), `getLedgerSign`/`isTopUpTransaction`/`getLedgerTone`, `topUpMinorToKes`/`formatTopUpAmount`, `canInitiatePayments` (`OWNER`/`ADMIN`), `isPaymentRailAvailable`/`getAvailablePaymentRails`/`getRailLabel`/`getRailDescription`, `buildWalletStatementUrl(filters,format)` (`/exports/wallet/statement?format=&from=&to=` trims `from`/`startDate` `to`/`endDate`), `buildWalletStatementFilename`, `formatTimestamp`, `summarizeWalletActivity`.
- `apps/dashboard/src/lib/wallet.test.ts` — **Created** — 15 tests for amount formatting, rail availability, statement URL (see Tests).

## Interfaces & Contracts

- `WalletPageData` includes `balance:number|null`, `currency:string`, `transactions:WalletTransaction[]`, `topUps:WalletTopUp[]`, `rails:PaymentRailType[]`.
- `PaymentRailProps` accepts `rail:PaymentRailType`, `balance:number|null`, `enabled:boolean`, `onSuccess?`/`onError?` callbacks.
- `buildWalletStatementUrl` matches `lib/exports.ts:buildWalletStatementUrl` contract (`/exports/wallet/statement?format={csv|pdf|xlsx}&from=&to=`).

## API Preservation

- Uses existing `GET /v1/wallet`, `GET /v1/wallet/transactions`, `GET /v1/wallet/top-ups` via `apiFetch` with JWT; `GET /v1/payments/bank-details` → `BankDetails` card; `POST /v1/payments/bank/confirm` `{amount,phone,paybillRef}` — corrected from prior absent bank rail (brief required).
- M-Pesa `POST /v1/payments/stk` + `GET /v1/payments/stk/:id` polling (90s timeout), card `POST /v1/payments/card` + `POST /v1/payments/card/:id/confirm`, PayPal `POST /v1/payments/paypal` + `POST /v1/payments/paypal/:id/capture`, invoice `POST /v1/wallet/top-ups` — all preserved with `sandbox` flag messaging.
- Exports via `GET /v1/exports/wallet/statement?format=&from=&to=` (`downloadReport` with `Authorization: Bearer` via `getStoredToken`/`token` param).
- Provider/consent/pricing untouched; no PII logged (no `console.log` of amounts treated as sensitive; only renders).

## UI / A11y / Constraints

- **Explicit states:** Loading skeletons (`aria-busy` hero/activity/ledger), `loadError` red alert with Retry, `exportError` amber alert with Dismiss, per-rail `RailMessage` loading (`aria-busy` button + `Waiting for PIN…`/`Processing…`/`Recording…`/`Requesting…`), success teal `role=status`, error red `role=alert`, empty ledger status with explainer.
- **Semantic labels:** Page `h1 Wallet`, section `aria-label` (Wallet balance, Wallet activity, Payment rails, Wallet ledger), rail `role=tablist/tab/tabpanel` with `aria-selected`/`aria-controls`/`aria-labelledby`, form `aria-label` per rail, inputs `Label htmlFor` + `aria-label`, buttons `aria-label` refresh/export, table `aria-label` + `scope=col` headers, timestamps `<time dateTime>`.
- **44px targets:** Refresh `h-11`, rail tabs `h-11`, all rail submit/capture/confirm buttons `h-11`, export buttons `h-11`, rail inputs `h-11` via `Input`, filter-style controls `h-11`.
- **Ledger:** Sign-aware via `formatLedgerAmount` (`+KES` `text-emerald-600` for `topup`, `−KES` `text-red-600` otherwise), running `balanceAfter` `tabular-nums KES …`, timestamps `toLocaleString('en-KE')`, `tabular-nums` on Amount/Balance/When, `Badge` tone green/blue per type, hover `hover:bg-slate-50/60` `motion-reduce:transition-none`.
- **Permission messaging:** Global amber `role=status` banner when `!canManage` (View-only wallet access + role name) + per-rail amber block + `View only` chip + `pointer-events-none opacity-60` content + `disabled` inputs/buttons.
- **Sandbox/live:** M-Pesa uses API `message` (mock `SANDBOX MODE — payment auto-completes…` vs live `STK push sent…`); card/PayPal fall back to `SANDBOX MODE — … auto-completes…` when `sandbox:true` else live prompts; bank/invoice have live guidance.
- **Reduced-motion:** Transitions `motion-reduce:transition-none` on tabs/buttons/table rows; no transform/opacity motion beyond `animate-pulse` skeletons which respect `prefers-reduced-motion` via Tailwind `motion-reduce`.

## Tests

All tests run via `npx vitest run`.

**New:** `apps/dashboard/src/lib/wallet.test.ts` — **15 passed**

- `formatKes` (2): 0→`KES 0.00`, 1234→`KES 1,234.00`, NaN/null→`KES 0.00`, negative preserved.
- `formatWalletBalance` (1): `KES —` for null, `KES 1,234` locale.
- `formatLedgerAmount/getLedgerSign/isTopUpTransaction` (2): `topup`→`+` otherwise `−`; ledger `+KES 1,000` / `−KES 500`.
- `topUpMinorToKes/formatTopUpAmount` (2): `'500000'`→5000, invalid→0, `formatTopUpAmount`→`KES 1,000`.
- `canInitiatePayments` (1): `OWNER`/`ADMIN` true, others false.
- `isPaymentRailAvailable/getAvailablePaymentRails` (3): `false`→all false/[]; `true`→all true/5 rails; `getRailLabel`→`M-Pesa`.
- `buildWalletStatementUrl` (4): csv/pdf/xlsx base, with `from`/`to`, `startDate`/`endDate` aliases, omits empty, filename `fleek-wallet-statement-2026-03-15.csv`.

**Existing suites still green:**

- `history.test.ts` — 27 passed
- `overview.test.ts` — 26 passed
- `verification-form.test.ts` — 18 passed
- **Total `apps/dashboard/src/lib`:** 4 files, **86 passed**.

## Verification Performed

- `pnpm --filter @fleek/dashboard typecheck` — **pass** (tsc --noEmit)
- `pnpm --filter @fleek/dashboard lint` — **pass** (0 errors, 0 warnings; fixed `CardContent` unused)
- `pnpm -w lint` — **pass** (7 tasks, dashboard 0 warnings; API 3 pre-existing warnings unchanged)
- `pnpm -w typecheck` — **pass** (10/10 tasks, turbo)
- `npx vitest run apps/dashboard/src/lib/wallet.test.ts --reporter=verbose` — **15/15 passed**
- `npx vitest run apps/dashboard/src/lib --reporter=verbose` — **86/86 passed**

## Commits

- _Not yet committed_ — working tree holds task-5 changes on top of `b5a22db`. Recommended commit message: `feat(dashboard): rebuild wallet with hero, rail tabs, bank rail, ledger and statement exports` (files listed above).

## Concerns / Follow-ups

- **Vitest per-app:** `apps/dashboard/package.json` has no `test` script; tests run via `npx vitest run apps/dashboard/src/lib/*` (root `vitest` 2.1.9). Consider adding `"test": "vitest run"` to dashboard for `pnpm --filter @fleek/dashboard test`.
- **Bank details caching:** `GET /payments/bank-details` fetched once on `load`; no polling. If admin rotates `PAYBILL_NUMBER`/`ACCOUNT_NAME`, user must hit Refresh. Acceptable per credential-gated monorepo.
- **Statement filters:** `buildWalletStatementUrl` supports `from`/`to` but page currently exports without date range (passes `{}`). History page already exposes date filters; future wallet page could add date range inputs reusing `buildWalletStatementUrl`.

## Report Path

`/home/zingri/dev/IPRS-WEB/.superpowers/sdd/2026-09-09-dashboard-admin-command-center/task-5-report.md`
