#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

WS="/Users/liumobei/.openclaw/workspace"
LOG="$WS/agents/reviews/life-assistant-heartbeat.log"
STATE="$WS/agents/workspaces/life-assistant/STATE.json"
TS="$(date '+%Y-%m-%d %H:%M:%S %z')"

mkdir -p "$WS/agents/reviews"

REMINDERS_OUT=""
REMINDERS_OK=false
if command -v remindctl >/dev/null 2>&1; then
  if REMINDERS_OUT=$(remindctl list OpenClaw 2>/dev/null); then
    REMINDERS_OK=true
  fi
fi

/usr/bin/printf '%s\n' "- ${TS} | reminders_ok=${REMINDERS_OK}" >> "$LOG"

python3 - <<'PY' "$STATE" "$TS" "$REMINDERS_OK"
import json
import sys
from pathlib import Path

state_path = Path(sys.argv[1])
ts = sys.argv[2]
reminders_ok = sys.argv[3] == "true"

state = {}
if state_path.exists():
    try:
        state = json.loads(state_path.read_text(encoding="utf-8"))
    except Exception:
        state = {}

state.update({
    "lastTick": ts,
    "remindersOk": reminders_ok,
})

state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
PY
