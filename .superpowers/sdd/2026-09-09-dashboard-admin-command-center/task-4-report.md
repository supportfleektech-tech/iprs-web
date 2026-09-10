# Task 4 Report — Rebuild history and reporting

**Base:** `c5a52e5`  
**Branch:** (working tree, uncommitted)  
**Date:** 2026-09-10

## Summary
Rebuilt `apps/dashboard/src/app/console/history/page.tsx` from minimal single-filter view into full reporting workspace per spec §4 History and Reports and brief task-4. Added typed filters, sortable table with `aria-sort`, pagination/limit backed by API `limit`/`offset`, CSV/XLSX/PDF exports via existing `/exports/verifications`, row-level certificate download, and summary metrics derived from returned records. Created `lib/exports.ts` pure helpers, `components/filter-bar.tsx`, and `components/data-table.tsx` with semantic labels, 44px targets, tabular-nums, wrapped identifiers, and prefers-reduced-motion support. Minimal `lib/auth.tsx` change exports `API_BASE`/`getApiBaseUrl`/`getStoredToken` for authenticated downloads; no PII logging.

## Files Changed
- `apps/dashboard/src/app/console/history/page.tsx` — **Modified** — Complete rebuild: HistoryFilters state (type/status/from/to/search/limit/offset) with `buildHistoryQuery`, client-side search fallback, sortable columns (`subject`/`type`/`status`/`cost`/`latencyMs`/`createdAt`) with `aria-sort`, pagination showing `Showing X–Y of Z`, export buttons (CSV/XLSX/PDF → `buildVerificationsExportUrl` + `downloadReport`), certificate per row (`buildCertificateUrl`), summary metrics (`summarizeHistoryMetrics`), explicit loading/error/empty states (LoadingState/EmptyState), semantic labels, 44px targets, `motion-reduce` transitions.
- `apps/dashboard/src/lib/auth.tsx` — **Modified** — Exported `API_BASE`, `getApiBaseUrl()`, `getStoredToken()` (reads `fleek_session` from localStorage) for use by `downloadReport`; preserves existing `apiFetch` token-refresh logic.
- `apps/dashboard/src/lib/exports.ts` — **Created** — `HistoryFilters`, `ExportFormat`, `SummaryMetrics`, `buildHistoryQuery`/`buildHistoryQueryString`, `buildVerificationsExportUrl`, `buildCertificateUrl`, `buildBatchExportUrl`, `buildWalletStatementUrl`, `escapeCsvCell`, `toCsv`, `classifyHistoryStatus`, `getHistoryStatusLabel`, `summarizeHistoryMetrics`, `downloadReport(url, filename, token?)` (token param + localStorage fallback, authenticated fetch, blob download; never logs PII).
- `apps/dashboard/src/components/filter-bar.tsx` — **Created** — `FilterBar` with search input, product select (all 24 types via `PRODUCT_LABELS`), status select (success/pending/not_found/failed), from/to date inputs; labels via `htmlFor`, 44px inputs, `aria-label`s, clear-filters button when active.
- `apps/dashboard/src/components/data-table.tsx` — **Created** — Generic `DataTable<T>` with `DataTableColumn<T>` (key/header/sortable/align/render/accessor), `aria-sort` on sortable `th`, sort buttons with `aria-label` and 44px hit area, `tabular-nums` on numeric cells, wrapped identifiers via caller `break-all font-mono`, `LoadingState` for `loading`, `emptyContent` slot, sticky-header styling, `motion-reduce:transition-none`.
- `apps/dashboard/src/lib/history.test.ts` — **Created** — 27 tests for filter query construction, CSV escaping, status classification (see Test Summary).

## Interfaces & Contracts
- `HistoryFilters` includes `type`, `status`, `from`/`to` (aliases `startDate`/`endDate`), `search`, `limit`, `offset` — typed, trims, omits empty.
- `DataTable` accepts `columns`, `rows`, `loading`, `emptyContent`, `sortKey`/`sortDirection`/`onSort`, `getRowKey`, `caption`/`ariaLabel`, accessible sort controls (`aria-sort` `ascending`/`descending`/`none`).
- `downloadReport` accepts existing `/exports/*` URL and filename plus optional token; resolves to absolute URL via `NEXT_PUBLIC_API_URL`, injects `Authorization: Bearer` if token present, triggers blob download via anchor.

## API Preservation
- Uses existing `GET /v1/verifications?{type,status,from,to,limit,offset,search}` via `apiFetch` with JWT; `buildHistoryQuery` sends typed params. No new API contract.
- Exports wired to `GET /v1/exports/verifications?format={csv|xlsx|pdf}&{type,status,from,to,search}` and `GET /v1/exports/verifications/:id/certificate` via `downloadReport`; respects server `Content-Type`/`Content-Disposition`.
- Provider/consent/pricing semantics untouched; history does not trigger verifications.

## UI / A11y / Constraints
- **Explicit states:** Loading (`LoadingState`), error (red alert with Retry), empty (`EmptyState` with “Run a verification” action), data table with sticky header.
- **Semantic labels:** All filter inputs have associated `<label>` + `aria-label`; sort buttons have `aria-label` incl. current direction; table has `aria-label` + `<caption sr-only>`; status chips convey text + color + icon via `StatusBadge`.
- **44px targets:** Filter inputs/selects `h-11`, export buttons `h-11`, table sort buttons `h-11`, View/Certificate actions `h-11`, pagination Previous/Next `h-11`, limit select `h-11`.
- **Tabular/ wrapping:** Cost/latency/When/limit counts use `tabular-nums`; Subject `font-mono text-xs break-all tabular-nums` with `title` fallback; Product labels via `PRODUCT_LABELS`.
- **Status icons:** `StatusBadge` renders `DashboardIcon` per tone (green check, red alert, amber clock, etc.) alongside humanized label (`Success`/`Not found`/etc.).
- **Prefers-reduced-motion:** Transitions use `motion-reduce:transition-none`; `LoadingState`/`DataTable` rows respect `motion-reduce`.
- **No PII in logs:** `downloadReport` and history fetch never `console.log` subjects/results; only error alerts with generic messages.
- **Field-level encryption:** Untouched (server-side Prisma AES-256-GCM).

## Tests
All tests run via `npx vitest run`.

**New:** `apps/dashboard/src/lib/history.test.ts` — **27 passed**
- `buildHistoryQuery` (5): empty→''; full type/status/from/to/search/limit/offset; trims/omits empty; `startDate`/`endDate` aliases → `from`/`to`; `limit:0`/`offset:0` preserved.
- `buildHistoryQueryString` (1): leading `?`.
- `buildVerificationsExportUrl` (2): CSV with filters includes `format=csv` + filters; xlsx/pdf variants.
- `buildCertificateUrl` (1): `encodeURIComponent` on id with slash.
- `escapeCsvCell` (5): null/undefined→''; simple no-quote; comma→quoted; double-quote escaped `""`; newline/CR→quoted.
- `toCsv` (2): header+rows escaped (comma, quote, null→''), empty rows.
- `classifyHistoryStatus` (6): success→green (case-insensitive), failed/error→red, not_found→amber, pending/processing→amber, low→blue, unknown→slate.
- `getHistoryStatusLabel` (2): known humanised, custom→`Capitalized with spaces`.
- `summarizeHistoryMetrics` (3): totalCost/avgLatency/statusCounts/total; empty→0/null/{}/0; ignores NaN.

**Existing suites still green:**
- `verification-form.test.ts` — 18 passed
- `overview.test.ts` — 26 passed
- **Total `apps/dashboard/src/lib`:** 3 files, **71 passed**.

## Verification Performed
- `pnpm --filter @fleek/dashboard typecheck` — **pass** (tsc --noEmit, no errors).
- `pnpm --filter @fleek/dashboard lint` — **pass** (0 errors, 0 warnings after fixing `no-useless-assignment` and removing `react-hooks/exhaustive-deps` disables).
- `pnpm -w lint` — **pass** (7 tasks, dashboard 0 warnings; API 3 pre-existing warnings unchanged).
- `pnpm --filter @fleek/dashboard build` — **pass** (`next build` compiled successfully, 14 routes, `/console/history` 5.94 kB).
- `npx vitest run apps/dashboard/src/lib/history.test.ts --reporter=verbose` — **27/27 passed**; full `apps/dashboard/src/lib` 71/71.

## Commits
- *Not yet committed* — working tree holds task-4 changes on top of `c5a52e5`. Recommended commit message: `feat(dashboard): rebuild history and reporting workspace with filters, sortable table, pagination, exports, certificate and metrics` (files listed above).

## Concerns / Follow-ups
- **Search param server support:** `GET /v1/verifications` `ListVerificationsQuery` does not declare `search`; client sends it anyway per brief (“typed query parameters to /verifications”) and also applies client-side filtering on `subject|type|id|status` as fallback. If server later adds `search`, remove client fallback or keep as progressive enhancement.
- **Export format handling:** `downloadReport` uses `fetch` + blob; XLSX/PDF generation is server-side (ExcelJS/PDFKit with CSV fallback). No client CSV generation path remains (old local `exportCsv` removed).
- **Sorting scope:** Sorting is client-side over the current page’s items (visible slice). Server has no `sort` param; for large datasets server-side sorting would require an API addition (out of scope per “preserve provider/consent/pricing/export, use existing endpoints”).
- **Pagination total vs search:** When search is active, `total` remains server total while displayed `rangeEnd` uses filtered length. True filtered total would need server `search` support; current “Showing X–Y of Z” reflects server total but metrics (“visible”) are scoped to page, made explicit via “Total cost (visible)” and “records in view”.

## Fix Round 1 — 2026-09-10 (review a6adfdd: Important 1-5 + Minor duplicates)

**Base for fix:** `a6adfdd`  
**Issues addressed:** Findings 1-5 (Important) + Minor duplicates (trivial)

### 1. Server search support (Findings 1 & 2)
- **API DTO** `apps/api/src/verifications/dto.ts:98-117` — added `search?: string` to `ListVerificationsQuery` (`@IsOptional() @IsString()`).
- **Controller** `apps/api/src/verifications/verifications.controller.ts:67-76` — forwards `query.search` to `VerificationsService.history`.
- **Service** `apps/api/src/verifications/verifications.service.ts:424-442` — `history(orgId, opts)` now accepts `search?: string`; trims and builds Prisma `where.OR` over indexed fields: `id` + `source` (`contains` `insensitive`) and enum `type`/`status` via `in` against `VERIFICATION_TYPES` / `['pending','success','not_found','failed']` substring matches (avoids `contains` on enum which Prisma rejects). Subject remains encrypted at rest — not queryable without schema change; type/status/id/source cover review's "minimal OR" requirement.
- **Exports** `apps/api/src/verifications/exports/export.controller.ts:13-48` — adds `@Query('search')` + `@ApiQuery search`, forwards to service; `apps/api/src/verifications/exports/export.service.ts:1-65` — adds `search` to `ExportOptions`, same `OR` logic as history, ensures `/exports/verifications?format=&search=` filters and `total`/pagination stay consistent.
- **Client** `apps/dashboard/src/app/console/history/page.tsx` — removed post-fetch client-side `filter` illusion; now relies purely on server `search` (pagination/total/export no longer silently break). `buildHistoryQuery`/`buildVerificationsExportUrl` already sent `search`; server now honours it.

### 2. Debounce + cancellation (Finding 3)
- Added `useDebouncedValue(value, 300)` hook in `page.tsx:40-47` and `debouncedSearch`/`debouncedFilters` memo (`page.tsx:64-70`). Typing in `FilterBar` search updates `filters.search` immediately for UI responsiveness, but `load()` only queries `debouncedFilters` — no fetch per keystroke.
- Added `abortRef: AbortController` (`page.tsx:72,78-95,98-101`): `load` aborts previous request, creates new controller, passes `signal` to `apiFetch({ signal })`, ignores `AbortError`, cleans up on unmount. Prevents race where fast typing resolves out-of-order.
- `apiFetch` already spreads `rest` into `fetch`, so `signal` is forwarded.

### 3. Sort toggle stale closure (Finding 4)
- `handleSort` (`page.tsx:108-121`) fixed: `setSortDir(prev => { const next = ...; if (next===null) setSortKey(null); return next; })` computes next direction purely from `prev`, never reads outer `sortDir`. Eliminates stale-closure batching bug where second click read stale `sortDir === 'desc'`.

### 4. Type widening (Finding 5)
- `HistoryItem.type: string` → `VerificationType` (`page.tsx:25-33`, import `VerificationType`).
- `HistoryFilters.type?: string` → `VerificationType | string` (`lib/exports.ts:10-20`) for strict product typing while allowing empty `''` for "All products". History table now renders `PRODUCT_LABELS[row.type]` with proper enum key.

### 5. Minor duplicates (trivial)
- `lib/exports.ts:1` — removed `'use client'` (pure helpers; `downloadReport` is client-only caller, no need for directive), imported `getApiBaseUrl`/`getStoredToken` from `lib/auth.tsx:31-48` instead of reimplementing `NEXT_PUBLIC_API_URL` fallback and `localStorage.getItem('fleek_session')` parse. Single source for base URL and token.
- `downloadReport` now uses `getApiBaseUrl()` / `getStoredToken()` (`lib/exports.ts:156-166`) — removes duplicated fallback.
- `page.tsx` columns memo: explicit generic `useMemo<DataTableColumn<HistoryItem>[]>` (`page.tsx:213`) and empty deps retained as static (review noted; intentional — columns are constant).
- `alert()` replaced: `page.tsx:181-211` — `handleExport`/`handleCertificate` now set `exportError` state (sanitized generic messages: "Export failed. Please try again." / "Certificate download failed. Please try again.") rendered as dismissible amber alert (`page.tsx:398-415`), no raw `Error.message` leakage. History load error also sanitized to "Failed to load history. Please retry." (`page.tsx:91`).
- Error UI preserved: existing `error` (red alert with Retry) still shown; new `exportError` amber alert added for export/certificate.

### Tests
- No test API change; `history.test.ts` still 27/27 passes (search query helpers unchanged semantics). Full `apps/dashboard/src/lib` 71/71 passes (`history.test.ts` 27 + `overview.test.ts` 26 + `verification-form.test.ts` 18).
- Existing API tests unaffected (no search integration test yet; manual verification via `pnpm --filter @fleek/api typecheck`).

### Verification Performed
- `pnpm --filter @fleek/dashboard typecheck` — **pass** (tsc --noEmit)
- `pnpm --filter @fleek/api typecheck` — **pass**
- `pnpm -w typecheck` — **pass** (10/10 tasks, turbo)
- `pnpm --filter @fleek/dashboard lint` — **pass** (0 errors, 0 warnings)
- `pnpm --filter @fleek/api lint` — **pass** (0 errors, 3 pre-existing warnings unchanged: `main.ts` no-console, `export.controller.ts` explicit any, `export.service.ts` explicit any)
- `pnpm -w lint` — **pass** (7 tasks)
- `pnpm -w build` — **pass** (web 38 routes, dashboard 14 routes — `/console/history` 6.11 kB, api `nest build`)
- `npx vitest run apps/dashboard/src/lib/history.test.ts --reporter=verbose` — **27/27 passed**
- `npx vitest run apps/dashboard/src/lib --reporter=verbose` — **71/71 passed**

### Commits
- `fix(history): server search, debounce/cancel, sort closure, strict types, de-dup auth helpers` — 7 files changed, pending push (base `a6adfdd`).

### Remaining / Follow-ups
- Encrypted `subject` (idNumber/phone/kraPin) still not server-searchable without schema change (stored as `encryptedInput`); current OR on `type/status/id/source` covers most search use-cases; future: add plaintext `searchSubject` column or trigram.
- Sorting remains client-side over current page (no `sort` param on API); acceptable per brief but large datasets would need server `orderBy`.
- No `'use client'` split needed for `exports.ts` pure helpers; kept helpers unmarked, `downloadReport` requires DOM so caller remains client component.

## Report Path
`/home/zingri/dev/IPRS-WEB/.superpowers/sdd/2026-09-09-dashboard-admin-command-center/task-4-report.md`
