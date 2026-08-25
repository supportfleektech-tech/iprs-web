# Build shared packages then the API
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/
COPY packages/providers/package.json packages/providers/
COPY packages/database/package.json packages/database/
COPY packages/tsconfig/package.json packages/tsconfig/
RUN pnpm install --frozen-lockfile=false

FROM deps AS build
COPY . .
RUN pnpm --filter @fleek/types build \
 && pnpm --filter @fleek/providers build \
 && pnpm --filter @fleek/database generate \
 && pnpm --filter @fleek/database build \
 && pnpm --filter @fleek/api exec nest build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/packages/database/dist packages/database/dist
COPY --from=build /app/packages/database/prisma packages/database/prisma
COPY --from=build /app/packages/types/dist packages/types/dist
COPY --from=build /app/packages/providers/dist packages/providers/dist
COPY --from=build /app/node_modules node_modules
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
