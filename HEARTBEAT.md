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

6) Delivery reporting
- Detect newly completed delivery tasks from timeline
- Append concise completion report to `agents/reviews/delivery-YYYYMMDD.md`
- Include: what delivered, verification status, commit reference if available

7) Slow-progress escalation
- Detect active tasks with no update beyond threshold and append to `agents/reviews/escalation-YYYYMMDD.md`
- Escalate with request_id, idle minutes, owner agent, and required follow-up
- Re-alert only after cooldown to avoid spam

8) Quiet hours
- 23:00-08:00 only alert on failures or urgent blockers

9) Control and recovery guardrails
- Check context waterline via session status; if >70%, create checkpoint file
- If >85% or drift detected, execute `agents/policy/RECOVERY_PLAYBOOK.md`
- Ensure each in-flight spawned task has dashboard linkage; auto-repair if missing

10) Seed auto-rebuild
- Run `scripts/seed/auto-rebuild.sh` to keep seed package in sync
- Log rebuilds to `agents/reviews/seed-rebuild-YYYYMMDD.md`
