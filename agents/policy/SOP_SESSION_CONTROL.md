# SOP_SESSION_CONTROL.md

## Scope
This SOP governs how 中枢 runs long sessions without drift, memory loss, or dashboard desync.

## Objectives
1. Keep main session responsive.
2. Keep all delegated work traceable in dashboard.
3. Preserve durable memory before context pressure.
4. Recover quickly from drift/failure.

## RACI
- Owner: 中枢 (execution + verification)
- Approver: 董事长 (priority and trade-offs)
- Executors: subagents (implementation tasks)

## Standard Loop
1. Plan
   - Define one main task + subtasks with clear `request_id`.
2. Dispatch
   - For each subtask: spawn subagent and immediately run `monitor-kit dispatch`.
3. Track
   - Maintain at most 2 concurrent subagents.
   - Update progress only with evidence.
4. Close
   - On completion, run verification commands.
   - Run `monitor-kit complete --request-id <id>`.
5. Persist
   - Append to `memory/YYYY-MM-DD.md` and checkpoint file.

## Required Fields Per Subtask
- request_id
- owner agent
- runId/sessionKey
- acceptance commands
- expected output
- rollback note (if risky)

## Waterline Control
- 70% context: write checkpoint and compact task notes.
- 85% context: stop new implementation; run recovery playbook.

## Verification Contract
Never report done until all are true:
- Command executed
- Output read back
- Files verified
- Status reflected in dashboard

## Recovery Entry Criteria
Enter recovery mode when any of:
- dashboard does not reflect in-flight runs
- memory inconsistency detected
- repeated contradiction/drift reported
- context >85%

Recovery doc: `agents/policy/RECOVERY_PLAYBOOK.md`

## Reporting Format (to user)
- Done: what changed
- Verified: command/output evidence
- Risk: unresolved issues
- Next: single clear next action

## Autonomous Assurance (No Silent Stall)
- Heartbeat writes `delivery-YYYYMMDD.md` for completed deliveries from timeline.
- Heartbeat writes `escalation-YYYYMMDD.md` when active tasks are stale (no progress over threshold).
- Escalation includes request_id, idle minutes, owner agent, and required follow-up.
- Re-alert uses cooldown to avoid spam while preventing silent deadlocks.
