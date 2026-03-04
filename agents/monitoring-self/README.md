# OpenClaw Self-Monitoring Panel

## Run backend
cd /Users/liumobei/.openclaw/workspace/agents/monitoring-self/backend
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn
uvicorn app:app --reload --host 127.0.0.1 --port 8000

## Open frontend
open /Users/liumobei/.openclaw/workspace/agents/monitoring-self/frontend/index.html

## Notes
- Frontend uses WebSocket `ws://127.0.0.1:8000/ws/live` for live push updates (2s server tick).
- If WebSocket is unavailable, frontend falls back to 2-second HTTP polling.
- Backend syncs workspace logs/states before each push/response.

## Phase-2 Real Data Integration
Import real handoff logs and agent states from workspace files:

```bash
cd /Users/liumobei/.openclaw/workspace/agents/monitoring-self/backend
source .venv/bin/activate
python ingest_comm_log.py
```

Optional demo seed:

```bash
curl -X POST http://127.0.0.1:8000/api/mock/seed
```

## Main Task APIs
Create a main task:

```bash
curl -X POST http://127.0.0.1:8000/api/main-tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"监控面板主任务","owner":"董事长"}'
```

Update main task progress:

```bash
curl -X PATCH http://127.0.0.1:8000/api/main-tasks/1 \
  -H 'Content-Type: application/json' \
  -d '{"status":"in_progress","progress_percent":70}'
```

Auto-create main task from a new demand:

```bash
curl -X POST http://127.0.0.1:8000/api/intake \
  -H 'Content-Type: application/json' \
  -d '{"demand":"为我做一个周报自动化流程","owner":"董事长"}'
```
