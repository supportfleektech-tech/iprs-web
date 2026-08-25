#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/web"
if [ -f /tmp/opencode/web.pid ] && kill -0 "$(cat /tmp/opencode/web.pid)" 2>/dev/null; then
  echo "already running ($(cat /tmp/opencode/web.pid))"
  exit 0
fi
mkdir -p /tmp/opencode
setsid nohup node_modules/.bin/next dev -p 3000 </dev/null > /tmp/opencode/web.log 2>&1 &
echo $! > /tmp/opencode/web.pid
echo "started pid $(cat /tmp/opencode/web.pid)"
