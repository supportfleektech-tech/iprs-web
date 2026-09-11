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
# Use env to explicitly pass all environment variables to node
env \
  DATABASE_URL="$DATABASE_URL" \
  JWT_SECRET="$JWT_SECRET" \
  FIELD_ENCRYPTION_KEY="$FIELD_ENCRYPTION_KEY" \
  PORT="$PORT" \
  ENABLED_CHECKS="$ENABLED_CHECKS" \
  USE_LIVE_UPSTREAM="$USE_LIVE_UPSTREAM" \
  UPSTREAM_BASE_URL="$UPSTREAM_BASE_URL" \
  UPSTREAM_API_KEY="$UPSTREAM_API_KEY" \
  LIVE_CHECKS="$LIVE_CHECKS" \
  DARAJA_CONSUMER_KEY="$DARAJA_CONSUMER_KEY" \
  DARAJA_CONSUMER_SECRET="$DARAJA_CONSUMER_SECRET" \
  DARAJA_SHORTCODE="$DARAJA_SHORTCODE" \
  DARAJA_PASSKEY="$DARAJA_PASSKEY" \
  DARAJA_ENV="$DARAJA_ENV" \
  DARAJA_CALLBACK_URL="$DARAJA_CALLBACK_URL" \
  PAYBILL_NUMBER="$PAYBILL_NUMBER" \
  PAYBILL_ACCOUNT="$PAYBILL_ACCOUNT" \
  BANK_NAME="$BANK_NAME" \
  BANK_BRANCH="$BANK_BRANCH" \
  ACCOUNT_NAME="$ACCOUNT_NAME" \
  FIELD_ENCRYPTION_KEY="$FIELD_ENCRYPTION_KEY" \
  JWT_SECRET="$JWT_SECRET" \
  JWT_EXPIRES_IN="$JWT_EXPIRES_IN" \
  REFRESH_EXPIRES_IN="$REFRESH_EXPIRES_IN" \
  CORS_ORIGINS="$CORS_ORIGINS" \
  PASSWORD_RESET_URL="$PASSWORD_RESET_URL" \
  SMTP_HOST="$SMTP_HOST" \
  SMTP_PORT="$SMTP_PORT" \
  SMTP_SECURE="$SMTP_SECURE" \
  SMTP_USER="$SMTP_USER" \
  SMTP_PASS="$SMTP_PASS" \
  SMTP_FROM="$SMTP_FROM" \
  TRUST_PROXY="$TRUST_PROXY" \
  NODE_ENV="$NODE_ENV" \
  setsid nohup node dist/main.js </dev/null > /tmp/opencode/api.log 2>&1 &
echo $! > /tmp/opencode/api.pid
echo "started pid $(cat /tmp/opencode/api.pid)"
