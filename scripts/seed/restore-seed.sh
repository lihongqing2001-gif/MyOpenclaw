#!/usr/bin/env bash
set -euo pipefail

ARCHIVE_PATH="${1:-}"
TARGET_DIR="${2:-$(pwd)}"

if [[ -z "$ARCHIVE_PATH" ]]; then
  echo "Usage: restore-seed.sh /path/to/openclaw-seed-*.tar.gz [target-dir]" >&2
  exit 1
fi

if [[ ! -f "$ARCHIVE_PATH" ]]; then
  echo "Archive not found: $ARCHIVE_PATH" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

tar -C "$TMP_DIR" -xzf "$ARCHIVE_PATH"

if [[ -f "$TMP_DIR/checksums.sha256" ]]; then
  (cd "$TMP_DIR" && shasum -a 256 -c checksums.sha256)
fi

mkdir -p "$TARGET_DIR"
rsync -a "$TMP_DIR/" "$TARGET_DIR/"

if [[ -f "$TARGET_DIR/seed/templates/env.example" ]]; then
  if [[ ! -f "$TARGET_DIR/.env.example" ]]; then
    cp "$TARGET_DIR/seed/templates/env.example" "$TARGET_DIR/.env.example"
  fi
fi

echo "Seed restored into: $TARGET_DIR"
echo "Next: inject secrets and run verify-seed.sh"
