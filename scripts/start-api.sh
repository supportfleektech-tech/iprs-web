#!/usr/bin/env bash
# Detached starter for the Fleek IPRS API (logs: /tmp/opencode/api.log, pid: /tmp/opencode/api.pid)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/api"
if [ -f /tmp/opencode/api.pid ] && kill -0 "$(cat /tmp/opencode/api.pid)" 2>/dev/null; then
  echo "already running ($(cat /tmp/opencode/api.pid))"
  exit 0
fi
mkdir -p /tmp/opencode
# Load environment variables from .env when present (CI passes them via environment)
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
# Explicitly export all variables to ensure they're available to child processes
export DATABASE_URL
export JWT_SECRET
export FIELD_ENCRYPTION_KEY
export PORT
export ENABLED_CHECKS
export USE_LIVE_UPSTREAM
export UPSTREAM_BASE_URL
export UPSTREAM_API_KEY
export LIVE_CHECKS
export DARAJA_CONSUMER_KEY
export DARAJA_CONSUMER_SECRET
export DARAJA_SHORTCODE
export DARAJA_PASSKEY
export DARAJA_ENV
export DARAJA_CALLBACK_URL
export PAYBILL_NUMBER
export PAYBILL_ACCOUNT
export BANK_NAME
export BANK_BRANCH
export ACCOUNT_NAME
export FIELD_ENCRYPTION_KEY
export JWT_SECRET
export JWT_EXPIRES_IN
export REFRESH_EXPIRES_IN
export CORS_ORIGINS
export PASSWORD_RESET_URL
export SMTP_HOST
export SMTP_PORT
export SMTP_SECURE
export SMTP_USER
export SMTP_PASS
export SMTP_FROM
export TRUST_PROXY
export NODE_ENV
# Launch with the exported environment as-is. NOTE: do NOT re-pass vars via
# `env VAR="$VAR"` — an unset var would arrive as an empty string, which
# defeats the app's `?? default` fallbacks (e.g. PORT="" crashes listen()).
setsid nohup node dist/main.js </dev/null > /tmp/opencode/api.log 2>&1 &
echo $! > /tmp/opencode/api.pid
echo "started pid $(cat /tmp/opencode/api.pid)"
