# AGENTS.md

Fleek IPRS — identity verification platform (Kenyan IPRS/KRA/phone/SIM-swap checks).
Monorepo: pnpm workspaces + Turborepo, Node ≥ 22, TypeScript strict.

## Commands

```bash
pnpm install
pnpm -w build            # ALWAYS first from clean checkout or after touching packages/* or prisma schema
pnpm -w lint && pnpm -w typecheck && pnpm -w test   # quality gates, same order as CI
pnpm exec playwright test                           # E2E (see prerequisites below)
```

- Run one package: `pnpm --filter @fleek/api <script>` (names: `@fleek/{web,dashboard,api,types,providers,database,ui}`).
- Unit tests (Vitest) exist only in `apps/api` and `packages/providers`.
- API runs **from compiled output**: `node apps/api/dist/main.js`. Use `scripts/start-api.sh` /
  `scripts/start-dashboard.sh` — detached, idempotent, logs+pids under `/tmp/opencode/`.

## E2E prerequisites

Playwright has **no webServer config** and retries=0 — all services must already be up:

1. `docker compose up -d postgres`
2. `pnpm -w build && pnpm --filter @fleek/database exec prisma migrate deploy && pnpm --filter @fleek/database seed`
3. API on :4000 (`scripts/start-api.sh`) and dashboard on :3001 (`scripts/start-dashboard.sh`)

Targets `http://localhost:3001` (dashboard), chromium only. CI (`.github/workflows/ci.yml`) shows the canonical boot order.

## Layout & boundaries

| Path | Role |
|---|---|
| `apps/web` | Marketing site, Next.js App Router, port 3000 |
| `apps/dashboard` | Client console + admin panel, Next.js, port 3001 |
| `apps/api` | NestJS REST API, global prefix `/v1`, OpenAPI at `/docs`, port 4000 |
| `packages/types` | Shared verification product/result types — the cross-app contract |
| `packages/providers` | `VerificationProvider` interface; `MockProvider` = deterministic sandbox |
| `packages/database` | Prisma schema/client + field-level AES-256-GCM encryption |

API loads `apps/api/.env` via dotenv at boot; needs `DATABASE_URL`, `JWT_SECRET`,
`FIELD_ENCRYPTION_KEY` or it won't start (see `apps/api/.env.example`).

## Gotchas

- **`NEXT_PUBLIC_*` is inlined at build time.** Changing runtime env does nothing for built
  frontends. In Docker they are build args (`Dockerfile.next`, `APP` arg selects web/dashboard);
  on Vercel they are project env vars set before build.
- **Rotating `FIELD_ENCRYPTION_KEY` silently breaks decryption of all stored verification PII**
  (key derived via sha256). Don't rotate casually.
- Every third-party integration is credential-gated: empty env vars ⇒ sandbox/mock behavior
  (deterministic MockProvider; M-Pesa mock gateway auto-completes ~3s). Never hardcode credentials
  or assume a real upstream exists.
- Verifications require `consent` + `consentCollectedBy`; results PII is encrypted at rest and
  **must never appear in logs** (Kenya DPA compliance posture).
- ESLint: one flat config at root; `no-explicit-any` is off, unused vars ignore `_` prefix.
- Seeded platform admin: `admin@fleektech.co.ke` / `Admin123!`; new orgs get KES 5,000 credit.

## Deployment

Two targets coexist:

- **Self-hosted prod** (api.fleekiprs.co.ke + currently all domains): Docker Compose project
  `fleek-iprs-prod` driven by `./deploy/deploy.sh` (`deploy.sh tls` issues certs). nginx configs in
  `deploy/nginx/`; `nginx/` holds runtime TLS certs/webroot and is gitignored. API runs with
  `TRUST_PROXY=true` behind nginx. Prod migrations = `prisma migrate deploy` (never `migrate dev`).
  See `deploy/DEPLOYMENT.md`.
- **Vercel hosts both frontends** (`iprs-web`, `iprs-dashboard` projects): monorepo setup with
  `rootDirectory=apps/<app>` set per project plus per-app `vercel.json` (`framework: nextjs`).
  Deploy via CLI prebuilt flow **from repo root** (linking inside an app dir breaks uploads —
  build traces reference files above the app directory).

## Git

CI gates every push to `main` and PRs; direct pushes to `main` are the current norm.
