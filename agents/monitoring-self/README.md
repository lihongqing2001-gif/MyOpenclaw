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
- Seed data endpoint is called automatically once at page load.

## Phase-2 Real Data Integration
Import real handoff logs from workspace COMM_LOG into monitor DB:

```bash
cd /Users/liumobei/.openclaw/workspace/agents/monitoring-self/backend
source .venv/bin/activate
python ingest_comm_log.py
```

Then refresh dashboard page.
