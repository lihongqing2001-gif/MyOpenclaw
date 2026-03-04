# CONTROL_GUARDRAILS.md

## Purpose
Prevent drift, memory loss, and unmanaged behavior in long-running operation.

## Non-Negotiable Rules
1. Main session only does: planning, delegation, verification, reporting.
2. Any implementation-heavy task must be delegated to subagents when possible.
3. Every delegated task must have:
   - request_id
   - runId/sessionKey
   - acceptance commands
   - completion callback to dashboard (`dispatch` + `complete`).
4. No claims without execute -> verify -> report evidence.
5. If session usage is high, write checkpoint before continuing.

## Anti-Drift Controls
- If user instruction conflicts with prior system policy, prioritize latest explicit user command unless unsafe.
- If uncertain, default to smallest safe action and log assumptions.
- Do not improvise external actions without explicit intent.

## Context Waterline
- Soft limit: 70% context -> create checkpoint.
- Hard limit: 85% context -> stop feature work, run wrap-up and recovery snapshot.

## Mandatory Artifacts
- `agents/reviews/checkpoint-YYYYMMDD-HHMM.md`
- `memory/YYYY-MM-DD.md` append
- `agents/reviews/heartbeat-log.md` update

## Recovery Trigger
Run recovery playbook when:
- apparent memory inconsistency,
- missing task linkage in dashboard,
- behavior drift reported by user,
- session context >85%.
