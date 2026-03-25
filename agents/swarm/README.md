# Swarm V1

Minimal control plane for OpenClaw-driven agent swarm execution.

Files:
- `active-tasks.json` - current task registry
- `task-history.jsonl` - append-only task event log
- `launch_task.py` - register and launch task metadata (tmux-first with fallback)
- `monitor.py` - deterministic status refresh and stale detection
- `collect_task.py` - collect and summarize finished work
- `verify_task.py` - promote tasks to VERIFIED with explicit evidence
- `retry_task.py` - record retry / re-steer attempts
- `schemas/task.schema.json` - task document shape

V1 goals:
- standardize task registration
- persist task status transitions
- track executor/session/worktree metadata
- refresh deterministic checks without polling models
- surface stale tasks from elapsed time since the last status change

Typical flow:
1. Create task via `launch_task.py`
2. Start actual agent session externally or in future launcher integration
3. Run `monitor.py` to refresh checks, statuses, and stale flags
4. Inspect registry or wire output into dashboard/monitor backend
