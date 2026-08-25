# syntax=docker/dockerfile:1
# Build shared packages then the API
FROM node:22-bookworm-slim AS base
# openssl must exist BEFORE pnpm install / prisma generate — Prisma's
# platform detection defaults to an OpenSSL-1.1 engine when it can't find it:
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable
# Tolerate slow/flaky registry links during installs (pnpm ignores
# NPM_CONFIG_* uppercase env forms — use .npmrc):
RUN printf 'fetch-timeout=600000\nfetch-retries=5\nfetch-retry-mintimeout=10000\nfetch-retry-maxtimeout=90000\nnetwork-concurrency=8\n' > /root/.npmrc
WORKDIR /app

FROM base AS deps
# Lockfile + .npmrc must precede install; otherwise `COPY . .` changes them,
# pnpm deems node_modules stale and triggers an implicit reinstall at build:
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
# Full manifest set: a partial workspace goes stale when `COPY . .` adds the
# rest, forcing pnpm to fetch missing deps at build time:
COPY apps/web/package.json apps/web/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/api/package.json apps/api/
COPY packages/ui/package.json packages/ui/
COPY packages/types/package.json packages/types/
COPY packages/providers/package.json packages/providers/
COPY packages/database/package.json packages/database/
COPY packages/tsconfig/package.json packages/tsconfig/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile=false

FROM deps AS build
COPY . .
RUN pnpm --filter @fleek/types build \
 && pnpm --filter @fleek/providers build \
 && pnpm --filter @fleek/database generate \
 && pnpm --filter @fleek/database build \
 && pnpm --filter @fleek/api exec nest build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
# openssl: Prisma engine runtime; wget + ca-certificates: compose healthcheck
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates wget \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/packages/types/dist packages/types/dist
COPY --from=build /app/packages/types/package.json packages/types/package.json
COPY --from=build /app/packages/providers/dist packages/providers/dist
COPY --from=build /app/packages/providers/package.json packages/providers/package.json
# workspace symlink targets need a valid package root, not just dist/:
COPY --from=build /app/packages/database/dist packages/database/dist
COPY --from=build /app/packages/database/prisma packages/database/prisma
COPY --from=build /app/packages/database/package.json packages/database/package.json
COPY --from=build /app/node_modules node_modules
# pnpm keeps per-package deps in workspace-local node_modules (symlinks into
# the root .pnpm store) — without these, runtime require() fails MODULE_NOT_FOUND:
COPY --from=build /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/packages/types/node_modules packages/types/node_modules
COPY --from=build /app/packages/providers/node_modules packages/providers/node_modules
COPY --from=build /app/packages/database/node_modules packages/database/node_modules
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
