# Inter-Agent Communication Protocol v1

## Topology
- Default: Hub-and-spoke via 中枢
- Direct agent-to-agent allowed only with request_id and mirrored log entry

## Message Schema
- request_id
- from_agent
- to_agent
- intent
- context_ref
- priority
- deadline
- risk_level
- expected_output
- status

## Status Values
NEW, ACK, IN_PROGRESS, BLOCKED, REVIEW, DONE, VERIFIED, ARCHIVED

## Escalation
Escalate to 中枢 if:
- Timeout exceeded
- Risk upgraded to L3
- Missing dependency blocks progress
- Conflicting requirements

## Logging Rule
Every completed handoff must be appended to `agents/runs/COMM_LOG.md`.
