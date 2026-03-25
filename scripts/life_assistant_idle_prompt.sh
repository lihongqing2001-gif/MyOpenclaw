#!/usr/bin/env bash
set -euo pipefail

WS="/Users/liumobei/.openclaw/workspace"
STATE="$WS/agents/workspaces/life-assistant/STATE.json"
LOG="$WS/agents/reviews/life-assistant-idle-prompt.log"
TS="$(date '+%Y-%m-%d %H:%M:%S %z')"

mkdir -p "$WS/agents/reviews"

IDLE_NS=$(ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF; exit}')
if [ -z "$IDLE_NS" ]; then
  /usr/bin/printf '%s\n' "- ${TS} | idle_check=failed" >> "$LOG"
  exit 0
fi

IDLE_MIN=$(python3 - <<'PY' "$IDLE_NS"
import sys
ns = int(sys.argv[1])
print(int(ns / 1_000_000_000 / 60))
PY
)

python3 - <<'PY' "$STATE" "$IDLE_MIN" "$TS"
import json
import sys
from pathlib import Path

state_path = Path(sys.argv[1])
idle_min = int(sys.argv[2])
ts = sys.argv[3]

state = {}
if state_path.exists():
    try:
        state = json.loads(state_path.read_text(encoding='utf-8'))
    except Exception:
        state = {}

state['idleMinutes'] = idle_min
state['lastIdleCheck'] = ts
state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding='utf-8')
PY

THRESHOLD_MIN=30
COOLDOWN_MIN=90

LAST_PROMPT_TS=$(python3 - <<'PY' "$STATE"
import json
import sys
from pathlib import Path
from datetime import datetime, timezone

state_path = Path(sys.argv[1])
if not state_path.exists():
    print("")
    raise SystemExit

state = json.loads(state_path.read_text(encoding='utf-8'))
print(state.get('lastIdlePromptAt') or "")
PY
)

CAN_PROMPT=true
if [ -n "$LAST_PROMPT_TS" ]; then
  CAN_PROMPT=$(python3 - <<'PY' "$LAST_PROMPT_TS" "$COOLDOWN_MIN"
from datetime import datetime, timezone
import sys

last = sys.argv[1]
cd = int(sys.argv[2])
try:
    last_dt = datetime.fromisoformat(last)
except Exception:
    print('true')
    raise SystemExit

now = datetime.now(timezone.utc)
if last_dt.tzinfo is None:
    last_dt = last_dt.replace(tzinfo=timezone.utc)

minutes = int((now - last_dt).total_seconds() // 60)
print('true' if minutes >= cd else 'false')
PY
  )
fi

if [ "$IDLE_MIN" -ge "$THRESHOLD_MIN" ] && [ "$CAN_PROMPT" = "true" ]; then
  if command -v remindctl >/dev/null 2>&1; then
    remindctl add --title "有空吗？需要安排点工作吗？" --list OpenClaw --due "$(date '+%Y-%m-%d %H:%M')" --no-input >/dev/null 2>&1 || true
  fi
  python3 - <<'PY' "$STATE"
import json
import sys
from pathlib import Path
from datetime import datetime, timezone

state_path = Path(sys.argv[1])
state = {}
if state_path.exists():
    try:
        state = json.loads(state_path.read_text(encoding='utf-8'))
    except Exception:
        state = {}

state['lastIdlePromptAt'] = datetime.now(timezone.utc).isoformat()
state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding='utf-8')
PY
  /usr/bin/printf '%s\n' "- ${TS} | idle_prompt=sent | idle_min=${IDLE_MIN}" >> "$LOG"
else
  /usr/bin/printf '%s\n' "- ${TS} | idle_prompt=skipped | idle_min=${IDLE_MIN}" >> "$LOG"
fi
