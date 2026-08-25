# Fleek IPRS — Production Deployment Guide

Target: a single Ubuntu 22.04+ VPS (2 vCPU / 4 GB is enough to start) with Docker installed.
Domains: `fleekiprs.co.ke` (marketing), `app.fleekiprs.co.ke` (console), `api.fleekiprs.co.ke` (REST API).

## 1. DNS

Create A records pointing all three hosts at your server's public IP:

| Host | Type | Value |
|---|---|---|
| `fleekiprs.co.ke` (+ `www`) | A | `<server-ip>` |
| `app.fleekiprs.co.ke` | A | `<server-ip>` |
| `api.fleekiprs.co.ke` | A | `<server-ip>` |

Wait for propagation before issuing certificates (`dig +short <host>`).

## 2. Server setup (once)

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker "$USER"   # re-login after this
git clone <your-repo-url> fleek-iprs && cd fleek-iprs
```

## 3. Secrets

```bash
cp deploy/.env.prod.example .env
nano .env    # fill in POSTGRES_PASSWORD, JWT_SECRET, FIELD_ENCRYPTION_KEY
             # openssl rand -hex 48 → JWT_SECRET
             # openssl rand -hex 32 → FIELD_ENCRYPTION_KEY
```

Add Daraja / upstream-verification credentials to the same file when you have them
(sections are clearly marked; the platform runs on sandbox/mock until then).

## 4. TLS certificates

```bash
./deploy/deploy.sh tls
```

Requires ports 80/443 open (`sudo ufw allow 80,443/tcp`). Certificates renew with:

```bash
docker compose -f docker-compose.prod.yml run --rm certbot renew
```

(Add that line to `/etc/crontab` monthly.)

## 5. Deploy

```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

The script builds images, applies Prisma migrations, and starts the full stack.
Verify:

```bash
curl https://api.fleekiprs.co.ke/v1/health          # {"status":"ok",...}
curl -I https://fleekiprs.co.ke                     # 200
open https://app.fleekiprs.co.ke/register           # create your org
```

## 6. First admin

Register through the console, then promote yourself to platform admin:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U fleek -d fleek_iprs \
  -c "UPDATE users SET \"isPlatformAdmin\" = true WHERE email = 'you@fleektech.co.ke';"
```

## 7. Enabling real integrations later

All third-party integrations read credentials from `.env` — no code changes needed.

| Integration | Env vars | Behaviour while empty |
|---|---|---|
| Live IPRS/KRA data | `USE_LIVE_UPSTREAM=true`, `UPSTREAM_BASE_URL`, `UPSTREAM_API_KEY`, `LIVE_CHECKS` | Deterministic mock provider |
| M-Pesa STK top-ups | `DARAJA_CONSUMER_KEY/SECRET/SHORTCODE/PASSKEY`, `DARAJA_ENV=sandbox\|production`, `DARAJA_CALLBACK_URL` | Mock gateway auto-completes |

After editing `.env`: `./deploy/deploy.sh` (rebuilds and restarts cleanly).

**Daraja note:** register your callback URL (`https://api.fleekiprs.co.ke/v1/payments/callback`)
on the Safaricom portal, then run `./deploy/deploy.sh tls` first so HTTPS is live —
Safaricom requires a valid certificate.

## 8. Operations cheat-sheet

```bash
docker compose -f docker-compose.prod.yml ps               # stack status
docker compose -f docker-compose.prod.yml logs -f api      # API logs
docker compose -f docker-compose.prod.yml down             # stop (data persists in pgdata volume)
```

Backups (recommended nightly cron):

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U fleek fleek_iprs | gzip > "/root/backups/fleek-$(date +%F).sql.gz"
```
