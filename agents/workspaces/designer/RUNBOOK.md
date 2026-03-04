# Designer Runbook

## Start
- Ensure STATE is READY
- Pick top priority item from INBOX

## Pause
- Set STATE to PAUSED
- Record handoff note in OUTBOX

## Resume
- Set STATE to READY
- Continue from latest handoff checkpoint

## Retire
- Set lifecycle to RETIRED in registry
- Archive workspace artifacts
