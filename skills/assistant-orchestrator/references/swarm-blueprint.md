# Swarm Blueprint

Use this reference when the user asks to build or refine an OpenClaw agent-swarm setup.

## Core Model

- OpenClaw holds business context, routing, memory, retries, and monitoring.
- Coding agents stay focused on implementation in isolated sessions/worktrees.
- Verification is deterministic: CI, PR checks, screenshots, and review gates.

## Recommended V1

Build these first:
- task registry
- launcher
- monitor
- done contract

Do not start with maximum concurrency.

## Suggested Task States

- NEW
- SCOPED
- DISPATCHED
- RUNNING
- REVIEW
- BLOCKED
- FAILED
- DONE
- VERIFIED
- ARCHIVED

## Suggested Files

```text
agents/swarm/
  README.md
  active-tasks.json
  task-history.jsonl
  launch_task.py
  monitor.py
  verify_task.py
  retry_task.py
  schemas/
    task.schema.json
  done_contracts/
    code.json
    ui.json
    pr.json
```

## Done Contract

Do not call a task done just because a PR exists.

Require evidence for:
- code committed
- tests passing
- CI passing
- PR ready
- screenshots if UI changed
- verification complete

## Retry Principle

Do not rerun the same prompt blindly.
Retry with tighter scope, missing context, or clarified success criteria.
