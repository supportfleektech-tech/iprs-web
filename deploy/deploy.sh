#!/usr/bin/env bash
# Fleek IPRS — production deploy helper.
# Usage:  ./deploy/deploy.sh          # build, migrate, start/refresh stack
#         ./deploy/deploy.sh tls      # first-time certificate issuance
set -euo pipefail
cd "$(dirname "$0")/.."

command -v docker >/dev/null || { echo "docker required"; exit 1; }
[ -f .env ] || { echo "Missing .env — copy deploy/.env.prod.example first."; exit 1; }

case "${1:-deploy}" in
  tls)
    echo "==> Issuing certificates (standalone HTTP challenge)…"
    # Temporarily serve challenges: nginx must be running with port 80 open.
    mkdir -p nginx/certs nginx/www
    docker compose -p fleek-iprs-prod -f docker-compose.prod.yml up -d nginx
    for domain in fleekiprs.co.ke app.fleekiprs.co.ke api.fleekiprs.co.ke; do
      docker compose -p fleek-iprs-prod -f docker-compose.prod.yml run --rm certbot certonly \
        --webroot -w /var/www/certbot \
        -d "$domain" --email "admin@fleektech.co.ke" --agree-tos --no-eff-email || \
        echo "!! Certificate for $domain failed — check DNS A records."
    done
    docker compose -p fleek-iprs-prod -f docker-compose.prod.yml exec nginx nginx -s reload || true
    echo "Done. Certificates renew via: docker compose -p fleek-iprs-prod -f docker-compose.prod.yml run --rm certbot renew"
    ;;

  deploy)
    echo "==> Building images…"
    docker compose -p fleek-iprs-prod -f docker-compose.prod.yml build

    echo "==> Applying database migrations…"
    docker compose -p fleek-iprs-prod -f docker-compose.prod.yml run --rm api \
      node packages/database/node_modules/prisma/build/index.js migrate deploy --schema packages/database/prisma/schema.prisma \
      || docker compose -p fleek-iprs-prod -f docker-compose.prod.yml run --rm api \
      npx prisma migrate deploy --schema packages/database/prisma/schema.prisma

    echo "==> Starting stack…"
    docker compose -p fleek-iprs-prod -f docker-compose.prod.yml up -d
    echo "==> Deployed. Health: curl https://api.fleekiprs.co.ke/v1/health"
    ;;

  *)
    echo "Usage: $0 [deploy|tls]"; exit 1;;
esac
