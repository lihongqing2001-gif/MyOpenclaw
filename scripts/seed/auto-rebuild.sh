#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SEED_DIR="$ROOT_DIR/seed"
BUILD_DIR="$SEED_DIR/build"
STATE_FILE="$BUILD_DIR/seed-state.json"
LOG_DIR="$ROOT_DIR/agents/reviews"
LOG_FILE="$LOG_DIR/seed-rebuild-$(date +%Y%m%d).md"

mkdir -p "$BUILD_DIR" "$LOG_DIR"

COMMIT="$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")"
DIRTY_FILES="$(git -C "$ROOT_DIR" status --porcelain || true)"
ALLOW_SHA="$(shasum -a 256 "$SEED_DIR/allowlist.txt" | awk '{print $1}')"
DENY_SHA="$(shasum -a 256 "$SEED_DIR/denylist.txt" | awk '{print $1}')"

FINGERPRINT_INPUT="$COMMIT\n$ALLOW_SHA\n$DENY_SHA\n$DIRTY_FILES"
FINGERPRINT="$(printf "%s" "$FINGERPRINT_INPUT" | shasum -a 256 | awk '{print $1}')"

LAST_FINGERPRINT=""
if [[ -f "$STATE_FILE" ]]; then
  LAST_FINGERPRINT="$(python3 - <<PY
import json
from pathlib import Path
path = Path("$STATE_FILE")
try:
    data = json.loads(path.read_text(encoding='utf-8'))
    print(data.get('fingerprint', '') or '')
except Exception:
    print('')
PY
)"
fi

if [[ "$FINGERPRINT" == "$LAST_FINGERPRINT" ]]; then
  exit 0
fi

ARCHIVE_PATH="$($ROOT_DIR/scripts/seed/build-seed.sh | sed -n 's/^Seed package created: //p' | tail -n 1)"

COMMIT="$COMMIT" ALLOW_SHA="$ALLOW_SHA" DENY_SHA="$DENY_SHA" DIRTY_FILES="$DIRTY_FILES" \
FINGERPRINT="$FINGERPRINT" ARCHIVE_PATH="$ARCHIVE_PATH" STATE_FILE="$STATE_FILE" \
python3 - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

state = {
    "updatedAt": datetime.now(timezone.utc).isoformat(),
    "commit": os.environ.get("COMMIT", "unknown"),
    "allowlistSha256": os.environ.get("ALLOW_SHA", ""),
    "denylistSha256": os.environ.get("DENY_SHA", ""),
    "dirty": bool(os.environ.get("DIRTY_FILES", "").strip()),
    "dirtyFiles": os.environ.get("DIRTY_FILES", "").splitlines(),
    "fingerprint": os.environ.get("FINGERPRINT", ""),
    "archive": os.environ.get("ARCHIVE_PATH", ""),
}
Path(os.environ["STATE_FILE"]).write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding='utf-8')
PY

if [[ ! -f "$LOG_FILE" ]]; then
  echo "# Seed Rebuild Log" > "$LOG_FILE"
  echo >> "$LOG_FILE"
fi

echo "- $(date '+%Y-%m-%d %H:%M:%S %z') | commit=$COMMIT | dirty=$([[ -n "$DIRTY_FILES" ]] && echo yes || echo no) | archive=$ARCHIVE_PATH" >> "$LOG_FILE"
