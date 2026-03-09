#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$ROOT/skills/qmd-skill" ]; then
  echo "qmd skill missing" >&2
  exit 1
fi

echo "ok"
