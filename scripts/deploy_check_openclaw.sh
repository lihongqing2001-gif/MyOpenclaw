#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/liumobei/.openclaw/workspace"
STRICT_PUBLIC=0

if [[ "${1:-}" == "--strict-public" ]]; then
  STRICT_PUBLIC=1
elif [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--strict-public]" >&2
  exit 1
fi

require_file() {
  local file_path="$1"
  test -f "$file_path"
}

require_absent_pattern() {
  local pattern="$1"
  local file_path="$2"
  if rg -n --fixed-strings "$pattern" "$file_path" >/dev/null; then
    echo "Found forbidden placeholder '$pattern' in $file_path" >&2
    exit 1
  fi
}

echo "[1/5] Checking Forge Console"
curl -fsS http://127.0.0.1:3000/ >/dev/null
curl -fsS http://127.0.0.1:3000/api/v1/local-packages >/dev/null
node -e 'const pkg=require(process.argv[1]); if (pkg.name!=="forge-console") { throw new Error(`unexpected package name: ${pkg.name}`); }' \
  "$ROOT/apps/mission-control/package.json"
require_absent_pattern "OpenClaw Web App" "$ROOT/apps/mission-control/README.md"
require_absent_pattern "/Users/liumobei/.codex/worktrees" "$ROOT/apps/mission-control/README.md"
require_file "$ROOT/apps/mission-control/.env.example"

echo "[2/5] Checking Forge Hub"
curl -fsS http://127.0.0.1:3400/ >/dev/null
curl -fsS http://127.0.0.1:3400/downloads >/dev/null
curl -fsS http://127.0.0.1:3400/community >/dev/null
curl -fsS http://127.0.0.1:3400/health >/dev/null
node -e 'const pkg=require(process.argv[1]); if (pkg.name!=="forge-hub") { throw new Error(`unexpected package name: ${pkg.name}`); }' \
  "$ROOT/apps/openclaw-web-platform/package.json"
require_file "$ROOT/apps/openclaw-web-platform/.env.example"

echo "[3/5] Checking GitHub handoff surface"
require_file "$ROOT/apps/openclaw-github-pages/index.html"
require_file "$ROOT/apps/openclaw-github-pages/README.md"

if [[ "$STRICT_PUBLIC" -eq 1 ]]; then
  require_absent_pattern "YOUR_ORG/YOUR_REPO" "$ROOT/apps/openclaw-github-pages/index.html"
  require_absent_pattern "app.your-domain.example" "$ROOT/apps/openclaw-github-pages/index.html"
  require_absent_pattern "127.0.0.1:3400" "$ROOT/apps/openclaw-github-pages/index.html"
fi

echo "[4/5] Checking deployment docs"
require_file "$ROOT/apps/mission-control/DEPLOYMENT.md"
require_file "$ROOT/apps/openclaw-web-platform/DEPLOYMENT.md"
require_file "$ROOT/DEPLOYMENT_GUIDE.md"
require_file "$ROOT/GITHUB_HANGOFF_GUIDE.md"

echo "[5/5] All checks passed"
