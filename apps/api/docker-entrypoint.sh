#!/bin/sh
# Render/small-host entrypoint: migrate + seed (idempotent) then start.
set -e

echo "==> Prisma migrate deploy"
node /app/packages/database/node_modules/prisma/build/index.js migrate deploy \
  --schema /app/packages/database/prisma/schema.prisma

echo "==> Seed (idempotent, safe to re-run)"
/app/packages/database/node_modules/.bin/tsx /app/packages/database/prisma/seed.ts \
  || echo "WARN: seed failed - continuing with existing data"

echo "==> Starting API"
exec node /app/apps/api/dist/main.js
