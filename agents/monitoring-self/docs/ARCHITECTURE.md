# OpenClaw Self-Monitoring Panel Architecture

## Goal
Build a lightweight real-time dashboard for agent runtime visibility.

## Stack
- Backend: FastAPI + SQLite (no ORM, direct SQL)
- Frontend: single-file HTML + TailwindCSS CDN + Vue 3 CDN + Fetch polling
- Storage: `agents/monitoring-self/data/monitor.db`

## Data Model

### tasks
- id INTEGER PK
- request_id TEXT UNIQUE
- agent_id TEXT
- task_desc TEXT
- difficulty TEXT (simple|medium|complex)
- status TEXT (assigned|in_progress|blocked|done)
- progress_percent INTEGER
- created_at TEXT
- updated_at TEXT

### agent_status
- id INTEGER PK
- agent_id TEXT UNIQUE
- activity TEXT (thinking|executing|waiting|idle)
- current_task_id INTEGER NULL
- updated_at TEXT

### token_log
- id INTEGER PK
- task_id INTEGER
- prompt_tokens INTEGER
- completion_tokens INTEGER
- total_tokens INTEGER
- created_at TEXT

## API
- GET `/api/agents/status`
  - Returns all agent runtime status + current task summary
- GET `/api/tasks/active`
  - Returns in-progress/blocked tasks with progress and token totals
- GET `/api/stats/tokens`
  - Returns global token totals + per-agent totals
- POST `/api/mock/seed`
  - Inserts demo data for UI preview

## Instrumentation Strategy
Use `AgentMonitor` hooks from any execution flow:
- `assign_task(agent_id, task_desc, difficulty, request_id=None)`
- `update_progress(task_id, status, progress_percent, activity=None)`
- `log_token_usage(task_id, prompt_tokens, completion_tokens)`

Suggested insertion points in OpenClaw-like workflows:
1. Right after request intake -> `assign_task`
2. On each state transition -> `update_progress`
3. After model response completion -> `log_token_usage`
