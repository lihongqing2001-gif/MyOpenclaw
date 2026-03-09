#!/usr/bin/env bash
set -euo pipefail

PKG_DIR="$1"
if [ -z "$PKG_DIR" ]; then
  echo "Usage: publish-script.sh <package_dir>" >&2
  exit 1
fi

MANIFEST="$PKG_DIR/capability-manifest.json"
if [ ! -f "$MANIFEST" ]; then
  echo "Missing capability-manifest.json" >&2
  exit 1
fi

ID=$(python - <<'PY'
import json,sys
m=json.load(open(sys.argv[1]))
print(m['id'])
PY
"$MANIFEST")
VER=$(python - <<'PY'
import json,sys
m=json.load(open(sys.argv[1]))
print(m['version'])
PY
"$MANIFEST")

ARCHIVE="${ID}-${VER}.tgz"

tar -czf "$ARCHIVE" -C "$PKG_DIR" .

SUM=$(shasum -a 256 "$ARCHIVE" | awk '{print $1}')
echo "$ARCHIVE checksum: $SUM"

# Placeholder: clawhub publish
# clawhub publish "$ARCHIVE"

mkdir -p outputs/publish
printf '%s %s\n' "$ARCHIVE" "$SUM" > outputs/publish/${ID}-${VER}.checksum.txt

echo "Publish prepared: $ARCHIVE"
