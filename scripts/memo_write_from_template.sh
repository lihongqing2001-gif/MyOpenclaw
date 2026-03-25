#!/usr/bin/env bash
set -euo pipefail
TARGET="$1"
SRC="${MEMO_TEMPLATE_PATH:-}"
if [ -z "$SRC" ] || [ ! -f "$SRC" ]; then
  exit 1
fi
cat "$SRC" > "$TARGET"
