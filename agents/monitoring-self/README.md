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
- Frontend polls backend every 2 seconds.
- Frontend calls `POST /api/sync` before each refresh to ingest latest workspace logs/states.

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
