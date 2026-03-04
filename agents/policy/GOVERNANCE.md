# Multi-Agent Governance v1

## Purpose
Build a stable and auditable multi-agent system with clear ownership, boundaries, and delivery quality.

## Roles
- Owner: 董事长
- Steward: 中枢
- Architect: 设计师
- Operator: 业务执行 Agent

## Principles
- Single responsibility
- Least privilege
- Explicit handoff
- Traceable decisions
- Human approval for high-risk actions

## Risk Levels
- L1: low-risk, reversible, internal edits
- L2: medium-risk, process-impacting changes
- L3: external send, prod changes, destructive operations, billing/permission impact (must approve)

## State Model
NEW -> ACK -> IN_PROGRESS -> REVIEW -> DONE -> VERIFIED -> ARCHIVED

## Self-Evolution Loop
Follow `agents/evolution/SELF_EVOLUTION_LOOP.md` for continuous improvement and knowledge promotion.
