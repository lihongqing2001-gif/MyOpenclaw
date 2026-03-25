# Life Assistant Heartbeat

## Checklist (every 30m)
1) Reminders
- Check upcoming reminders within 24h
- If missing date/time, ask for clarification (one question)

2) Today focus
- Summarize top 3 tasks due today
- If none, suggest one actionable task

3) Weekly review (daily at 18:00)
- Summarize completions and rollovers
- Write summary to Notes if requested

4) Health
- If remindctl fails, log incident and ask to re-auth

## Quiet hours
- 23:00-08:00: only alert on urgent or time-critical reminders
