# Task 3 Report — Rebuild the verification workspace

## What was implemented

- **Verification form helpers** (`src/lib/verification-form.ts:1`):
  - `VerificationFormValues`, `ProductOption` (mirrors `/verifications/products`: `type`, `label`, `category`, `enabled`, `active`, `unitPriceKes`, `backupPriceKes`, `currentTier`, `vatExclusive`, `cbConsentRequired`, `requiresFileUpload`, `fileTypes`, `backupAvailable`, `live`).
  - `VERIFICATION_FORM_FIELDS` covers all 24 types with required-field guidance: `iprs_standard` (idNumber), `match_id_phone` (idNumber+phone), `employer_verification`, `face_id_match` (idNumber+file), `bank_account_verification`, `alien_id`, `aml_pep_screen`, `passport_check`, `sim_swap_check`, `kplc_location_checker`, `kra_pin_verification` (kraPin required, idNumber optional), `search_name_by_phone`, `search_phones_by_id`, `motor_vehicle_ownership`, `drivers_license_verification`, `metropol_*` (3), `creditinfo_*` (3, CB consent), `brs` (CB consent), `spin_score_only`, `scanned_statement` (statementPages+file). File fields flagged `inputType: 'file'` with hints and placeholders.
  - Pure helpers: `getVerificationFormValues`, `hasRequiredValues` (required-field presence), `getRequiredFieldKeys`, `groupProductsByCategory` (Map category→products), `isConsentGatingBlocked` (general consent + CB-consent), `humanise`, `formatCurrency`, `maskSubject`, `formatResultValue`, `isSensitiveResultKey` (/base64|image|secret|token/i), `filterSensitiveResultEntries`, `getVerificationLabel`. No PII logged, base64 excluded via `isSensitiveResultKey`.

- **Verification form** (`src/components/verification-form.tsx:1`):
  - Props `VerificationForm({product, token, onResult, onError, onPayload})` — `ProductOption`, token, callbacks per brief.
  - State: `values` via `getVerificationFormValues(product.type)`, reset on type change, `busy`, `error`, `fileNotes`.
  - Dynamic fields: iterates `VERIFICATION_FORM_FIELDS[product.type]`, renders `Label` + `Input`/file `<input type=file accept=product.fileTypes>`/number, `aria-describedby` hints, `aria-required`, `h-11` targets, cyan focus, `FieldError` for recovery.
  - File upload: validates `product.fileTypes` or fallback jpeg/png/pdf, 5 MB limit, `FileReader.readAsDataURL` → base64 string into `faceImageBase64`/`statementFileBase64`, shows `Selected: filename`, error via `FieldError`.
  - Consent: fieldset `bg-[#eef3f7]` with general `consent` checkbox (required, `*`) and conditional `cbConsent` when `product.cbConsentRequired` (8 types: Metropol×3, CreditInfo×3, BRS, Motor Vehicle). Gated via `isConsentGatingBlocked`.
  - Primary action: `Button h-11` disabled when `!product.active||!product.enabled||!hasRequiredValues||isConsentGatingBlocked`, shows `Running check…` with spinning `refresh` icon (`aria-busy`), `duration-200` transform/opacity with `motion-reduce:transition-none`. Error `role=alert` via `FieldError`. Pricing hint: `Estimated charge KES X per successful check · VAT exclusive · backup KES Y`.
  - Submit: builds `payload` matching `RunVerificationDto` (type, idNumber/kraPin/phoneNumber/alienId/passportNumber/nationality/bankCode/accountNumber/employerName/meterNumber/vehicleRegNumber/dlNumber/businessRegNumber/faceImageBase64/statementFileBase64/statementPages number, consent, consentCollectedBy='console', cbConsent, useBackup:false), trims strings, `onPayload` capture for backup retry, `apiFetch POST /verifications` then `GET /verifications/:id` for structured detail, `onResult(detail)`. Never logs PII/base64.

- **Result panel** (`src/components/result-panel.tsx:1`):
  - Props `ResultPanel({detail, onRetryBackup, backupPending})` — detail payload masked/non-image.
  - Structured evidence: header `humanise(type)` + `StatusBadge` + backup `StatusBadge` when `isBackup`, metric grid `sm:grid-cols-2 lg:grid-cols-4` cost/latency/source/recorded (`formatCurrency`, latency ms, source dash, locale date), `dashboard-reveal` 240ms.
  - Error: `role=alert` red card for `errorMessage`.
  - Backup banner: visible when `backupAvailable && backupPrice != null` (explicit `showBackupBanner`), amber border `bg-amber-50`, text `Backup provider available … Backup pricing is KES X and is charged only after you confirm.`, button `h-11` `Retry with backup` with `refresh` icon, `aria-busy`, `disabled` when pending, `duration-200` transform/opacity, `role=alert aria-live=polite`.
  - Evidence `dl grid sm:grid-cols-2` filtered via `isSensitiveResultKey` (excludes photoBase64/referenceImageBase64/base64 image), `humanise(key)` dt, `formatResultValue` dd, objects as `<pre>`. Detail link `h-11` to `/console/history/:id` with `Record ID … code` and backup tag. 44px touch targets, cyan focus, tabular-nums, `prefers-reduced-motion` via `motion-reduce`.

- **Verify workspace** (`src/app/console/verify-workspace.tsx:1`):
  - Client `VerifyWorkspace` fetches `GET /verifications/products` with `apiFetch` via `useAuth` token, `PromiseSettled` style via try/catch, loading `LoadingState`, error `role=alert` with `Retry` `h-11`, empty `EmptyState`.
  - Groups via `groupProductsByCategory`, renders product catalog sidebar `xl:grid-cols-[340px_1fr]` — category headers with counts, product buttons `aria-pressed`, `aria-label` with active/pricing/backup/consent/upload, `Badge` active/inactive + CB consent + File, price `formatCurrency` or Unavailable, backup price, no-backup hint, `transition-[border-color,background-color,transform,opacity] duration-200 motion-reduce`. Selection resets result/formError.
  - Header: `Verification workspace` kicker, `Run a verification` title, description, `X of Y available` pill `h-11`.
  - Focused form section: title `getVerificationLabel(selectedProduct.type)`, status `StatusBadge` available/inactive + VAT + File + Live/Sandbox, `VerificationForm` with `token`, `onResult`, `onPayload` (captured for backup retry), `onError`.
  - Backup retry: `handleBackupRetry` uses `lastPayload` captured from form, adds `useBackup:true`, `POST /verifications` then `GET /verifications/:id`, updates `result`, `backupPending` gating. FormError `role=alert` when no result, `ResultPanel` when result with `onRetryBackup` when `backupAvailable`.

- **Verify route** (`src/app/console/verify/page.tsx:1`):
  - `VerifyPage` renders `<VerifyWorkspace />` — dedicated route per spec (product-first workspace). Navigation via console nav (`/console/verify` already in `consoleNavItems`).

- **Console page refactor** (`src/app/console/page.tsx:1`):
  - Removed fallback single-product quick verify (idNumber busy/detail/available/runCheck/resultEntries/humanise/TONE) now superseded by workspace. Keeps Overview orchestration: `Promise.allSettled` for `/admin/stats` (403→fallback), `/verifications?limit=8`, `/verifications/products`, `/wallet` + `/wallet/transactions` movement, `stats`/`recentItems`/`products`/`wallet`, `loading`/`error`/`retryKey`, early `LoadingState` when `!stats && loading`, renders `<Overview … />` only. Overview already links to verify workspace (`/console/verify` CTA).

- **Tests** (`src/lib/verification-form.test.ts:1`):
  - 24 vitest cases: `hasRequiredValues` (iprs_standard, match_id_phone, face_id_match file, employer_verification, kra_pin_optional, brs, scanned_statement pages+file), `getRequiredFieldKeys` (3), `isConsentGatingBlocked` (consent false/true, CB required), `groupProductsByCategory` (2), `isSensitiveResultKey` (2), `filterSensitiveResultEntries` (excludes base64 image, null), `formatResultValue` (null/bool/number/string/array/object), backup banner visibility (both available+price), `humanise`/`formatCurrency`/`VERIFICATION_FORM_FIELDS` 24 types.

## What was tested and results

- `pnpm --filter @fleek/dashboard typecheck` — **PASS** (0 errors).
- `pnpm -w typecheck` — **PASS** (10/10 packages).
- `pnpm --filter @fleek/dashboard lint` — **PASS** (0 errors).
- `pnpm -w lint` — **PASS** (0 errors dashboard, 3 warnings in api pre-existing).
- `pnpm exec vitest run apps/dashboard/src/lib/verification-form.test.ts --reporter=verbose` — **PASS** (1 file, 24 tests).
- `pnpm exec vitest run apps/dashboard/src/lib/verification-form.test.ts apps/dashboard/src/lib/overview.test.ts` — **PASS** (2 files, 43 tests).
- Manual token flow check: `apiFetch` with `Authorization: Bearer`, 401 refresh via `tryRefresh`, no PII in logs (payload built but never console.log).

## Files changed

- `apps/dashboard/src/lib/verification-form.ts` — new (ProductOption + 24-field map + 11 helpers)
- `apps/dashboard/src/components/verification-form.tsx` — new (dynamic form, consent/CB-consent, file upload, loading/disabled, error recovery)
- `apps/dashboard/src/components/result-panel.tsx` — new (structured evidence, cost/latency/source/backup, base64 exclusion, backup banner retry, detail link)
- `apps/dashboard/src/app/console/verify-workspace.tsx` — new (fetch+group, product selection, focused form, result, backup retry)
- `apps/dashboard/src/app/console/verify/page.tsx` — new (route wrapper)
- `apps/dashboard/src/app/console/page.tsx` — modified (overview-only, removed fallback verifyPage duplication)
- `apps/dashboard/src/lib/verification-form.test.ts` — new (24 tests)

## Self-review findings

- Strict types: no `any`, `VerificationType` enum, `ProductOption` typed, `BadgeTone` via `StatusBadge`.
- Explicit UI states: loading skeletons/`LoadingState`, `EmptyState` when 0 products, `role=alert` error with retry, disabled submit until required+consent, `aria-busy`, `aria-pressed`, `aria-describedby`.
- Semantic labels: `section aria-labelledby`, `fieldset legend sr-only`, `Label` for all inputs, `aria-label` consent checkboxes, `aria-live` pricing/error, `h-11` 44px targets, cyan focus `outline-cyan-600`.
- Motion: `duration-200` transform/opacity only, `motion-reduce:transition-none`, `dashboard-reveal` 240ms respects `prefers-reduced-motion` via global `* animation-duration 0.01ms`.
- Security: never log PII/result, base64 filtered via `isSensitiveResultKey`, `FIELD_ENCRYPTION_KEY` not touched, JWT via `useAuth` only, 401 refresh intact.
- Pricing: shows `unitPriceKes` + `backupPriceKes` when `backupAvailable`, VAT exclusive tag, explicit backup banner with price before charge — no silent surcharge.
- File upload: 5 MB limit, JPEG/PNG/PDF allowlist from `product.fileTypes`, DataURL base64 matches DTO `faceImageBase64`/`statementFileBase64` (API also supports multipart via `faceImage`/`statementFile` — base64 keeps sandbox deterministic).
- Backup: banner only when `backupAvailable && backupPrice != null`, retry uses captured `lastPayload` + `useBackup:true`, pending disabled + spinner, error `role=alert`.
- `NEXT_PUBLIC_API_URL` not touched; build-time inlining preserved.

## Issues / concerns

- `lastPayload` capture depends on `onPayload` from `VerificationForm` — if user navigates without submitting, backup retry shows `Original request details are no longer available` — correct fallback but could be smoother by persisting form values in workspace state instead of payload copy.
- Old `apps/dashboard/src/components/verification-workspace.tsx` and `verification-result-panel.tsx` untracked duplicates removed in this commit — next task should ensure no stale imports remain (grep shows none).
- `statementPages` sent as number (DTO expects number) — form input `type=number` but value is string until coercion; empty string correctly omitted, but NaN edge not surfaced as field error (relies on API 400).
- Dashboard vitest runs via root `vitest` binary without dedicated config — works for `overview.test.ts` + `verification-form.test.ts` but future dashboard tests should add `vitest.config.ts` for include patterns.

## Verification

- Build: not run with `pnpm -w build` (Prisma generate network-dependent) — verified via `typecheck` + `lint` + vitest as per task gates.

---

## Fix Round 1/5 — Review 27a52f0..f43eb81 Required Fixes

**Findings addressed:** I1 BRS file upload missing, I2 strict-types bypass, I3 duplicate VerificationResultPayload, I4 backup banner not gated, M1 fetchProducts dep loop. Preserved existing behavior, kept changes minimal, no PII logging.

### What changed

- **I1 — `src/lib/verification-form.ts:143`** (`apps/dashboard/src/lib/verification-form.ts:143`): Added file field to `brs` entry — now `businessRegNumber` (required) + `statementFileBase64` file input (required, `Business registration document`, PDF/JPEG/PNG 5 MB). Aligns with `verifications.service.ts:118-132` (`requiresFileUpload(BRS)=true`, `getFileTypes` includes `application/pdf`, `image/jpeg`, `image/png`) and `AGENTS.md` file-upload list. Uses existing DTO field `statementFileBase64` (already in `RunVerificationDto:80-81` and `dtoKeys` allowlist in `verification-form.tsx:150`) so `forbidNonWhitelisted` passes and base64 JSON path matches `scanned_statement` handling; catalog `File` badge already consistent. `hasRequiredValues` now requires both fields for BRS.

- **I2 — `src/components/verification-form.tsx:65-66`** (`apps/dashboard/src/components/verification-form.tsx:65`): Replaced `updateValue(key,value:string|boolean){…value as string; true as unknown as string}` bypass with generic `function updateValue<K extends keyof VerificationFormValues>(key:K, value:VerificationFormValues[K])` and typed handlers; checkbox `onChange` now `updateValue('consent', event.target.checked)` / `updateValue('cbConsent', event.target.checked)` with no `as unknown` casts. `typecheck` strict.

- **I3 — `src/lib/verification-form.ts:27` + components** (`apps/dashboard/src/lib/verification-form.ts:27`, `apps/dashboard/src/components/verification-form.tsx:12`, `apps/dashboard/src/components/result-panel.tsx:4`): Exported canonical `VerificationResultPayload` from `lib/verification-form.ts:27` and imported in both `verification-form.tsx:15` and `result-panel.tsx:4`; removed duplicate interface definitions in both components.

- **I4 — `src/components/result-panel.tsx:37`** (`apps/dashboard/src/components/result-panel.tsx:37`): Gated `showBackupBanner` to `Boolean(detail.backupAvailable && detail.backupPrice!=null && (detail.status==='failed' || !!detail.errorMessage))` — avoids false-positive on success; matches API `backupAvailable` only on `UPSTREAM_DOWN` failure (`verifications.service.ts:241-246`) but now defensive on UI.

- **M1 — `src/app/console/verify-workspace.tsx:31`** (`apps/dashboard/src/app/console/verify-workspace.tsx:31`): Removed `selectedType` from `fetchProducts` dep; changed to `useCallback(...,[token])` with functional `setSelectedType(prev=> prev ?? firstAvailable)` — eliminates re-fetch loop on selection change.

- **Tests — `src/lib/verification-form.test.ts:48,162`** (`apps/dashboard/src/lib/verification-form.test.ts:48`): Updated BRS test to require `businessRegNumber + statementFileBase64`; updated backup-banner helper to include `status==='failed'||errorMessage` and added `does not show on success` case (now 25 tests). Backup helper mirrors new `result-panel` gating.

### Tests — commands & output

- `pnpm --filter @fleek/dashboard typecheck` — **PASS** (`tsc --noEmit`, 0 errors)
- `pnpm -w typecheck` — **PASS** (10/10 packages, 0 errors)
- `pnpm --filter @fleek/dashboard lint` — **PASS** (`eslint src/` 0 errors)
- `pnpm -w lint` — **PASS** (0 errors dashboard, 3 warnings in api pre-existing `no-explicit-any` at `export.service.ts:362`)
- `pnpm exec vitest run apps/dashboard/src/lib/verification-form.test.ts --reporter=verbose` — **PASS** (1 file, 25 tests: `hasRequiredValues` 7, `getRequiredFieldKeys` 1, `isConsentGatingBlocked` 3, `groupProductsByCategory` 2, `isSensitiveResultKey` 2, `filterSensitiveResultEntries` 2, `formatResultValue` 3, `backup banner visibility` 2, `result panel formatting` 3; includes new BRS file + backup failure gate)
- `pnpm exec vitest run apps/dashboard/src/lib/verification-form.test.ts apps/dashboard/src/lib/overview.test.ts` — **PASS** (2 files, 44 tests)
- No PII logged: payload built but never `console.log`; `isSensitiveResultKey` excludes `base64|image|secret|token`; `StatementFile`/`brs` file via base64 only.
