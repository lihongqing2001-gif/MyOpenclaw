# Knowledge Capture Playbook

## Trigger
Use this playbook when:
- a task is completed with stable result
- a failure is diagnosed and fixed
- a reusable pattern is discovered

## Steps
1. Record facts in `agents/reviews/retro-YYYYMMDD.md`.
2. Classify:
   - Principle -> `L0-overview`
   - Tactic -> `L1-playbooks`
   - Procedure -> `L2-runbooks`
   - Failure -> `L3-postmortems`
   - Reusable command/template -> `L4-snippets`
3. Add exact commands and verification output.
4. Add prevention/guardrails for failure items.
5. Link related files and commit.

## Promotion Rules
- L4 -> L2: same snippet succeeds at least 3 times.
- L2 -> L1: runbook reusable across at least 2 scenarios.
- L1 -> L0: becomes policy-level decision guidance.
