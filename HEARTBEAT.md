# HEARTBEAT.md

## Heartbeat Checklist (every 30m)

1) Monitor health
- Check `http://127.0.0.1:8000/api/health`
- If not ok: restart monitoring backend and report error cause

2) Active work review
- Read `api/main-tasks` and `api/tasks/active`
- If no active business tasks for >4h during daytime, propose next concrete task

3) Self-improvement status
- Ensure self-improvement module is healthy
- If unhealthy, log incident and create repair task

4) WhatsApp channel
- Check `openclaw channels status --probe --json`
- If disconnected, run WA recovery checklist and log result

5) Knowledge capture
- Append key events to `agents/reviews/retro-YYYYMMDD.md`
- Promote stable snippets into `agents/knowledge/L4-snippets/`

6) Quiet hours
- 23:00-08:00 only alert on failures or urgent blockers
