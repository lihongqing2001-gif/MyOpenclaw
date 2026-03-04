#!/usr/bin/env bash
set -euo pipefail

WS="/Users/liumobei/.openclaw/workspace"
LOG="$WS/agents/reviews/heartbeat-log.md"
STATE="$WS/memory/heartbeat-state.json"
TS="$(date '+%Y-%m-%d %H:%M:%S %z')"

mkdir -p "$WS/memory" "$WS/agents/reviews"

HEALTH="$(curl -sS http://127.0.0.1:8000/api/health || echo '{"ok":false}')"
DEMAND="$(curl -sS http://127.0.0.1:8000/api/demand/summary || echo '{}')"
ACTIVE_MAIN="$(curl -sS http://127.0.0.1:8000/api/main-tasks || echo '[]')"
ACTIVE_TASKS="$(curl -sS http://127.0.0.1:8000/api/tasks/active || echo '[]')"
WA="$(openclaw channels status --probe --json 2>/dev/null || echo '{}')"

python3 - <<'PY' "$HEALTH" "$DEMAND" "$ACTIVE_MAIN" "$ACTIVE_TASKS" "$WA" "$LOG" "$STATE" "$TS"
import json,sys
health=json.loads(sys.argv[1])
demand=json.loads(sys.argv[2])
main=json.loads(sys.argv[3])
tasks=json.loads(sys.argv[4])
wa=json.loads(sys.argv[5])
log_path=sys.argv[6]
state_path=sys.argv[7]
ts=sys.argv[8]

wa_connected = wa.get('channels',{}).get('whatsapp',{}).get('connected')
line=f"- {ts} | health_ok={health.get('ok')} | main={len(main)} tasks={len(tasks)} | demand={demand.get('satisfaction_percent')}% | wa_connected={wa_connected}\n"
with open(log_path,'a',encoding='utf-8') as f:
    f.write(line)

state={
  'lastTick': ts,
  'healthOk': health.get('ok'),
  'mainActive': len(main),
  'tasksActive': len(tasks),
  'demand': demand.get('satisfaction_percent'),
  'waConnected': wa_connected
}
with open(state_path,'w',encoding='utf-8') as f:
    json.dump(state,f,ensure_ascii=False,indent=2)
PY
