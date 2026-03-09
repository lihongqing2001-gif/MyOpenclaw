#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Example: validate qmd skill exists
if [ ! -d "$ROOT/skills/qmd-skill" ]; then
  echo "Missing skills/qmd-skill" >&2
  exit 1
fi

# Placeholder for real install steps
mkdir -p "$ROOT/outputs"

echo "Installed cap.openclaw.knowledge.qmd"
