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
setsid nohup node dist/main.js </dev/null > /tmp/opencode/api.log 2>&1 &
echo $! > /tmp/opencode/api.pid
echo "started pid $(cat /tmp/opencode/api.pid)"
