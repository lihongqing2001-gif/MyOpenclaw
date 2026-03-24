#!/usr/bin/env bash
set -euo pipefail

echo "[1/4] Checking mission-control"
curl -fsS http://127.0.0.1:3000/ >/dev/null
curl -fsS http://127.0.0.1:3000/api/v1/local-packages >/dev/null

echo "[2/4] Checking web platform"
curl -fsS http://127.0.0.1:3400/ >/dev/null
curl -fsS http://127.0.0.1:3400/health >/dev/null

echo "[3/4] Checking deployment docs"
test -f /Users/liumobei/.openclaw/workspace/apps/mission-control/DEPLOYMENT.md
test -f /Users/liumobei/.openclaw/workspace/apps/openclaw-web-platform/DEPLOYMENT.md
test -f /Users/liumobei/.openclaw/workspace/DEPLOYMENT_GUIDE.md

echo "[4/4] All checks passed"
