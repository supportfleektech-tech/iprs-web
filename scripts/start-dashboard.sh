#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/dashboard"
if [ -f /tmp/opencode/dashboard.pid ] && kill -0 "$(cat /tmp/opencode/dashboard.pid)" 2>/dev/null; then
  echo "already running ($(cat /tmp/opencode/dashboard.pid))"
  exit 0
fi
mkdir -p /tmp/opencode
setsid nohup node_modules/.bin/next dev -p 3001 </dev/null > /tmp/opencode/dashboard.log 2>&1 &
echo $! > /tmp/opencode/dashboard.pid
echo "started pid $(cat /tmp/opencode/dashboard.pid)"
