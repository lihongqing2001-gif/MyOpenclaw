#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SEED_DIR="$ROOT_DIR/seed"
ALLOWLIST="$SEED_DIR/allowlist.txt"
DENYLIST="$SEED_DIR/denylist.txt"
BUILD_DIR="$SEED_DIR/build"
STAGE_DIR="$BUILD_DIR/stage"
DIST_DIR="$SEED_DIR/dist"

if [[ ! -f "$ALLOWLIST" ]]; then
  echo "Missing allowlist: $ALLOWLIST" >&2
  exit 1
fi

if [[ ! -f "$DENYLIST" ]]; then
  echo "Missing denylist: $DENYLIST" >&2
  exit 1
fi

mkdir -p "$BUILD_DIR" "$DIST_DIR"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"

TMP_ALLOWLIST="$BUILD_DIR/allowlist.resolved"
: > "$TMP_ALLOWLIST"
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  [[ "$path" == \#* ]] && continue
  if [[ -e "$ROOT_DIR/$path" ]]; then
    echo "$path" >> "$TMP_ALLOWLIST"
  else
    echo "Skip missing path: $path" >&2
  fi
done < "$ALLOWLIST"

rsync -a --prune-empty-dirs --exclude-from="$DENYLIST" --files-from="$TMP_ALLOWLIST" "$ROOT_DIR/" "$STAGE_DIR/"

TS="$(date +"%Y%m%d-%H%M%S")"
COMMIT="$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")"
ALLOW_SHA="$(shasum -a 256 "$ALLOWLIST" | awk '{print $1}')"
DENY_SHA="$(shasum -a 256 "$DENYLIST" | awk '{print $1}')"

STAGE_DIR="$STAGE_DIR" COMMIT="$COMMIT" ALLOW_SHA="$ALLOW_SHA" DENY_SHA="$DENY_SHA" \
python3 - <<PY
import json
import os
from datetime import datetime, timezone

stage = os.environ["STAGE_DIR"]
files = []
for root, _, names in os.walk(stage):
    for name in names:
        path = os.path.join(root, name)
        rel = os.path.relpath(path, stage)
        files.append(rel)
files.sort()

manifest = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "sourceCommit": os.environ.get("COMMIT", "unknown"),
    "fileCount": len(files),
    "allowlistSha256": os.environ["ALLOW_SHA"],
    "denylistSha256": os.environ["DENY_SHA"],
    "files": files,
}

with open(os.path.join(stage, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, sort_keys=True)
    f.write("\n")
PY

(
  cd "$STAGE_DIR"
  find . -type f -print0 | sort -z | xargs -0 shasum -a 256 > checksums.sha256
)

ARCHIVE="$DIST_DIR/openclaw-seed-$TS.tar.gz"
tar -C "$STAGE_DIR" -czf "$ARCHIVE" .

echo "Seed package created: $ARCHIVE"
