#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(pwd)}"
ALLOWLIST="$ROOT_DIR/seed/allowlist.txt"

if [[ ! -f "$ALLOWLIST" ]]; then
  echo "Missing allowlist: $ALLOWLIST" >&2
  exit 1
fi

missing=0
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  [[ "$path" == \#* ]] && continue
  if [[ ! -e "$ROOT_DIR/$path" ]]; then
    echo "Missing: $path"
    missing=1
  fi
done < "$ALLOWLIST"

if [[ $missing -ne 0 ]]; then
  echo "Verify failed: missing allowlisted files" >&2
  exit 1
fi

echo "Verify passed: allowlisted files present"
