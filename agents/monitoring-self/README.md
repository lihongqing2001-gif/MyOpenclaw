# OpenClaw Self-Monitoring Panel

## Run backend
cd /Users/liumobei/.openclaw/workspace/agents/monitoring-self/backend
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn
uvicorn app:app --reload --host 127.0.0.1 --port 8000

## Open frontend
open /Users/liumobei/.openclaw/workspace/agents/monitoring-self/frontend/index.html

## Role-based write guard
Write APIs require header:

- `X-Role: chairman` or `X-Role: admin`

## Core APIs added
- SLA/Overdue: `GET /api/tasks/active` (fields: `due_at`, `overdue`)
- L3 approval flow: `POST /api/approvals`
- Dependencies (DAG edge): `POST /api/dependencies`
- Weighted satisfaction: `GET /api/demand/summary`
- Timeline: `GET /api/timeline`
- Reports: `GET /api/reports/weekly`, `GET /api/reports/monthly`
- Health: `GET /api/health`
- Self-heal: `POST /api/self-heal`
- Replay chain: `GET /api/replay/{request_id}`
- Demand intake: `POST /api/intake`

## Examples
Create demand -> auto main task card + seed subtask:

```bash
curl -X POST http://127.0.0.1:8000/api/intake \
  -H 'X-Role: chairman' \
  -H 'Content-Type: application/json' \
  -d '{"demand":"为监控面板加审批流","owner":"董事长"}'
```

Create L3 subtask:

```bash
curl -X POST http://127.0.0.1:8000/api/subtasks \
  -H 'X-Role: chairman' \
  -H 'Content-Type: application/json' \
  -d '{
    "main_task_id":1,
    "agent_id":"executor-v1",
    "task_desc":"执行生产级变更",
    "difficulty":"complex",
    "risk_level":"L3",
    "due_at":"2026-03-05T12:00:00"
  }'
```

Approve L3 subtask:

```bash
curl -X POST http://127.0.0.1:8000/api/approvals \
  -H 'X-Role: admin' \
  -H 'Content-Type: application/json' \
  -d '{"task_id": 9, "decision":"approved", "note":"go"}'
```

Add dependency:

```bash
curl -X POST http://127.0.0.1:8000/api/dependencies \
  -H 'X-Role: chairman' \
  -H 'Content-Type: application/json' \
  -d '{"task_id": 10, "depends_on_task_id": 9}'
```

Run self-heal:

```bash
curl -X POST http://127.0.0.1:8000/api/self-heal -H 'X-Role: admin'
```
