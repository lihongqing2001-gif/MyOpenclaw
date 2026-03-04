# Agent-to-Agent Runtime Bridge

## Status
- persistent_thread_runtime: unavailable in current channel plugin
- fallback_runtime: enabled (hub-orchestrated run jobs + durable logs)

## How it works
1. 中枢 receives a request and assigns request_id.
2. 中枢 dispatches step jobs to target agents.
3. Each hop is logged to `agents/runs/COMM_LOG.md`.
4. Outputs are written to each agent OUTBOX and linked by request_id.

## Guarantees
- Explicit handoff with request_id
- Full traceability in workspace logs
- Compatible with current runtime constraints
