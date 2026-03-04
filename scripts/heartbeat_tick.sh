#!/usr/bin/env bash
set -euo pipefail

WS="/Users/liumobei/.openclaw/workspace"
LOG="$WS/agents/reviews/heartbeat-log.md"
DELIVERY_LOG="$WS/agents/reviews/delivery-$(date +%Y%m%d).md"
STATE="$WS/memory/heartbeat-state.json"
TS="$(date '+%Y-%m-%d %H:%M:%S %z')"

mkdir -p "$WS/memory" "$WS/agents/reviews"

HEALTH="$(curl -sS http://127.0.0.1:8000/api/health || echo '{"ok":false}')"
DEMAND="$(curl -sS http://127.0.0.1:8000/api/demand/summary || echo '{}')"
ACTIVE_MAIN="$(curl -sS http://127.0.0.1:8000/api/main-tasks || echo '[]')"
ACTIVE_TASKS="$(curl -sS http://127.0.0.1:8000/api/tasks/active || echo '[]')"
TIMELINE="$(curl -sS http://127.0.0.1:8000/api/timeline || echo '[]')"
WA="$(openclaw channels status --probe --json 2>/dev/null || echo '{}')"

python3 - <<'PY' "$HEALTH" "$DEMAND" "$ACTIVE_MAIN" "$ACTIVE_TASKS" "$TIMELINE" "$WA" "$LOG" "$DELIVERY_LOG" "$STATE" "$TS"
import json,sys
from pathlib import Path

health=json.loads(sys.argv[1])
demand=json.loads(sys.argv[2])
main=json.loads(sys.argv[3])
tasks=json.loads(sys.argv[4])
timeline=json.loads(sys.argv[5])
wa=json.loads(sys.argv[6])
log_path=Path(sys.argv[7])
delivery_path=Path(sys.argv[8])
state_path=Path(sys.argv[9])
ts=sys.argv[10]

prior={}
if state_path.exists():
    try:
        prior=json.loads(state_path.read_text(encoding='utf-8'))
    except Exception:
        prior={}
last_timeline_id=int(prior.get('lastTimelineId', 0) or 0)

wa_connected = wa.get('channels',{}).get('whatsapp',{}).get('connected')
line=f"- {ts} | health_ok={health.get('ok')} | main={len(main)} tasks={len(tasks)} | demand={demand.get('satisfaction_percent')}% | wa_connected={wa_connected}\n"
with log_path.open('a',encoding='utf-8') as f:
    f.write(line)

new_events=[]
max_id=last_timeline_id
for ev in timeline:
    ev_id=int(ev.get('id',0) or 0)
    if ev_id>max_id:
        max_id=ev_id
    if ev_id>last_timeline_id and ev.get('event_type') in {'task_completed','main_task_updated'}:
        new_events.append(ev)

if not delivery_path.exists():
    delivery_path.write_text('# Delivery Reports\n\n', encoding='utf-8')

if new_events:
    with delivery_path.open('a', encoding='utf-8') as f:
        for ev in sorted(new_events, key=lambda x: x.get('id', 0)):
            f.write(f"- {ev.get('created_at')} | {ev.get('event_type')} | {ev.get('request_id') or '-'} | {ev.get('message')} | verification=recorded\n")

state={
  'lastTick': ts,
  'healthOk': health.get('ok'),
  'mainActive': len(main),
  'tasksActive': len(tasks),
  'demand': demand.get('satisfaction_percent'),
  'waConnected': wa_connected,
  'lastTimelineId': max_id
}
state_path.write_text(json.dumps(state,ensure_ascii=False,indent=2), encoding='utf-8')
PY
