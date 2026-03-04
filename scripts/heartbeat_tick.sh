#!/usr/bin/env bash
set -euo pipefail

WS="/Users/liumobei/.openclaw/workspace"
LOG="$WS/agents/reviews/heartbeat-log.md"
DELIVERY_LOG="$WS/agents/reviews/delivery-$(date +%Y%m%d).md"
ESCALATION_LOG="$WS/agents/reviews/escalation-$(date +%Y%m%d).md"
STATE="$WS/memory/heartbeat-state.json"
TS="$(date '+%Y-%m-%d %H:%M:%S %z')"

mkdir -p "$WS/memory" "$WS/agents/reviews"

HEALTH="$(curl -sS http://127.0.0.1:8000/api/health || echo '{"ok":false}')"
DEMAND="$(curl -sS http://127.0.0.1:8000/api/demand/summary || echo '{}')"
ACTIVE_MAIN="$(curl -sS http://127.0.0.1:8000/api/main-tasks || echo '[]')"
ACTIVE_TASKS="$(curl -sS http://127.0.0.1:8000/api/tasks/active || echo '[]')"
TIMELINE="$(curl -sS http://127.0.0.1:8000/api/timeline || echo '[]')"
WA="$(openclaw channels status --probe --json 2>/dev/null || echo '{}')"

python3 - <<'PY' "$HEALTH" "$DEMAND" "$ACTIVE_MAIN" "$ACTIVE_TASKS" "$TIMELINE" "$WA" "$LOG" "$DELIVERY_LOG" "$ESCALATION_LOG" "$STATE" "$TS"
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

STALE_MINUTES = 90
RE_ALERT_MINUTES = 180

health = json.loads(sys.argv[1])
demand = json.loads(sys.argv[2])
main = json.loads(sys.argv[3])
tasks = json.loads(sys.argv[4])
timeline = json.loads(sys.argv[5])
wa = json.loads(sys.argv[6])
log_path = Path(sys.argv[7])
delivery_path = Path(sys.argv[8])
escalation_path = Path(sys.argv[9])
state_path = Path(sys.argv[10])
ts = sys.argv[11]

now = datetime.now(timezone.utc)

def parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
    except Exception:
        return None

prior = {}
if state_path.exists():
    try:
        prior = json.loads(state_path.read_text(encoding='utf-8'))
    except Exception:
        prior = {}

last_timeline_id = int(prior.get('lastTimelineId', 0) or 0)
alerted = prior.get('alertedTasks', {}) if isinstance(prior.get('alertedTasks', {}), dict) else {}

wa_connected = wa.get('channels', {}).get('whatsapp', {}).get('connected')
line = f"- {ts} | health_ok={health.get('ok')} | main={len(main)} tasks={len(tasks)} | demand={demand.get('satisfaction_percent')}% | wa_connected={wa_connected}\n"
with log_path.open('a', encoding='utf-8') as f:
    f.write(line)

new_events = []
max_id = last_timeline_id
for ev in timeline:
    ev_id = int(ev.get('id', 0) or 0)
    if ev_id > max_id:
        max_id = ev_id
    if ev_id > last_timeline_id and ev.get('event_type') in {'task_completed', 'main_task_updated'}:
        new_events.append(ev)

if not delivery_path.exists():
    delivery_path.write_text('# Delivery Reports\n\n', encoding='utf-8')
if new_events:
    with delivery_path.open('a', encoding='utf-8') as f:
        for ev in sorted(new_events, key=lambda x: x.get('id', 0)):
            f.write(f"- {ev.get('created_at')} | {ev.get('event_type')} | {ev.get('request_id') or '-'} | {ev.get('message')} | verification=recorded\n")

if not escalation_path.exists():
    escalation_path.write_text('# Escalation Reports\n\n', encoding='utf-8')

stall_events = []
for task in tasks:
    request_id = task.get('request_id') or f"task-{task.get('id')}"
    updated_at = parse_dt(task.get('updated_at'))
    if not updated_at:
        continue
    age_minutes = int((now - updated_at).total_seconds() // 60)
    if age_minutes < STALE_MINUTES:
        continue

    last_alert = parse_dt(alerted.get(request_id))
    if last_alert is not None:
        since_alert = int((now - last_alert).total_seconds() // 60)
        if since_alert < RE_ALERT_MINUTES:
            continue

    stall_events.append((request_id, age_minutes, task.get('task_desc'), task.get('agent_id')))
    alerted[request_id] = now.isoformat()

if stall_events:
    with escalation_path.open('a', encoding='utf-8') as f:
        for request_id, age_minutes, desc, agent_id in stall_events:
            f.write(
                f"- {ts} | type=slow_progress | request_id={request_id} | idle_min={age_minutes} | agent={agent_id} | action=escalate_and_report | task={desc}\n"
            )

state = {
    'lastTick': ts,
    'healthOk': health.get('ok'),
    'mainActive': len(main),
    'tasksActive': len(tasks),
    'demand': demand.get('satisfaction_percent'),
    'waConnected': wa_connected,
    'lastTimelineId': max_id,
    'alertedTasks': alerted,
}
state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding='utf-8')
PY

"$WS/scripts/seed/auto-rebuild.sh" || true
