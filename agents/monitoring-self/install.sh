#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
VENV="$BACKEND/.venv"
REQ="$ROOT/requirements.txt"

mkdir -p "$ROOT/data" "$ROOT/toolkit"

python3 -m venv "$VENV"
source "$VENV/bin/activate"
pip install --upgrade pip >/dev/null
pip install -r "$REQ" >/dev/null

if [ ! -f "$ROOT/toolkit/config.json" ]; then
  cp "$ROOT/toolkit/config.example.json" "$ROOT/toolkit/config.json"
fi

chmod +x "$ROOT/monitor-kit" "$ROOT/toolkit/monitor_kit.py"

"$ROOT/monitor-kit" doctor || true
"$ROOT/monitor-kit" start || true

cat <<EOF

Install complete.
- CLI: $ROOT/monitor-kit
- Frontend: $ROOT/frontend/index.html
EOF
