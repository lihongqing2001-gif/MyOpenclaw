# OpenClaw + Codex/ClaudeCode Agent Swarm Setup

## Source Summary

This note captures Elvis Sun's article about using OpenClaw as an orchestration layer over Codex / Claude Code style coding agents.

Core idea:
- Do not use one coding agent directly for everything.
- Use OpenClaw as the high-level orchestrator that holds business context, historical decisions, customer notes, and routing logic.
- Spawn specialized coding agents for implementation work in isolated worktrees/sessions.
- Monitor progress automatically and notify the human only when review-ready.

## Why This Works

The article's key claim is that context windows are zero-sum:
- If a model carries too much code context, it loses business context.
- If a model carries too much business context, it loses room for detailed code reasoning.

So the system splits responsibility:
- Orchestrator: strategy, memory, customer context, retries, prompt rewriting, task routing.
- Coding agents: focused code execution in isolated environments.

## Claimed Benefits

- Very high output with low manual terminal babysitting.
- Faster idea-to-PR cycle.
- Better fit for founder-led product development.
- Better separation between sensitive business access and code-only execution.

## 8-Step Workflow From The Article

1. Customer request arrives.
   - Orchestrator scopes request using existing business memory.
   - Can fetch production/customer context using safer privileged access.

2. Spawn agent.
   - One worktree per task.
   - One session per agent.
   - Prompt includes only relevant context.

3. Monitor in a loop.
   - Registry tracks all active tasks.
   - A deterministic monitor checks session health, PR state, CI, and failure conditions.

4. Agent creates PR.
   - Agent commits, pushes, and opens PR.

5. Automated code review.
   - Multiple reviewers comment on PRs.
   - Different models catch different issues.

6. Automated testing.
   - CI runs lint, type checks, unit tests, E2E, and UI checks.

7. Human review.
   - Human only enters after PR is actually review-ready.

8. Merge and cleanup.
   - Merge done PRs.
   - Cleanup stale worktrees and registry entries.

## Definitions Of Done

A task is not done when a PR exists.
A task is done only when all are true:
- PR created
- Branch synced / no merge conflict
- CI passing
- Required AI/code reviews passing
- UI screenshots included when needed
- Human review is easy and low-friction

## Important Design Principles

### 1. Orchestrator Keeps Sensitive Context
The orchestrator can hold:
- meeting notes
- customer context
- product decisions
- past failures
- read-only production access

Coding agents should not automatically receive broad sensitive access.

### 2. Specialize By Context, Not Just Model Brand
The article argues specialization is mostly about loading the right context into the right agent.

### 3. Retry With Better Guidance
If an agent fails, do not just rerun the same prompt.
The orchestrator should inspect why it failed and retry with narrower scope or better context.

### 4. Monitor Deterministically
Use low-cost status checks instead of repeatedly asking models for updates.

### 5. Human Attention Is Expensive
The system should only escalate when there is true need for review or intervention.

## Suggested Mapping To This Workspace

### Existing Pieces Already Present
This workspace already has pieces that map well:
- session control SOPs in `agents/policy/`
- dashboard / monitoring assets in `agents/dashboard/` and `agents/monitoring-self/`
- knowledge base in `agents/knowledge/`
- playbooks and agent registry in `agents/playbooks/` and `agents/registry/`

### Gaps To Implement
To match the article more closely, add these layers:

1. Task registry
- Single JSON or SQLite registry of active agent tasks
- Fields: request id, branch, worktree, session, status, checks, retries, notify state

2. Worktree launcher
- Script that creates isolated worktrees per task
- Installs deps if needed
- Starts Codex / Claude Code / ACP agent in dedicated session

3. Agent monitor loop
- Deterministic checker for:
  - alive session/process
  - branch pushed or not
  - PR exists or not
  - CI state
  - review state
  - retry count

4. Review pipeline
- Standard PR review contract
- Required checks per PR type
- Screenshot gate for UI changes

5. Retry/re-steer system
- If task fails, orchestrator rewrites prompt based on failure evidence
- Retry with bounded attempts

6. Notification layer
- Notify only when blocked, failed beyond retry budget, or ready for human review

## Step-By-Step Implementation Plan

### Phase 1: Minimal Swarm Backbone
Goal: make task spawning traceable.

Implement:
- `agents/swarm/active-tasks.json`
- launcher script for one task -> one worktree -> one session
- standard task metadata template
- completion status update flow

Success criteria:
- can spawn 1 task
- task appears in registry
- session/worktree are recorded
- status can move from running -> done/failed

### Phase 2: Deterministic Monitoring
Goal: stop manual babysitting.

Implement:
- periodic monitor script
- session alive check
- git branch / PR existence check
- CI status check
- stale task detection

Success criteria:
- monitor can summarize all active tasks without querying models
- stale or dead sessions are flagged automatically

### Phase 3: Review Contract
Goal: define real "done".

Implement:
- PR checklist policy
- UI screenshot requirement
- review record fields in registry
- verification gate before notify

Success criteria:
- no task is marked done just because a PR exists
- human notification only fires when review-ready

### Phase 4: Retry Intelligence
Goal: recover instead of restarting blindly.

Implement:
- failure categories
- re-steer templates
- bounded retry counter
- orchestration note per retry

Success criteria:
- failed tasks can be re-steered with more focused prompts
- retries are evidence-driven

### Phase 5: Multi-Agent Routing
Goal: pick the right executor.

Implement:
- routing policy by task type
- Codex for deeper backend/refactor/debug tasks
- Claude Code / other agent for frontend / git / faster UI iterations
- optional design-spec step before implementation

Success criteria:
- orchestrator chooses agent type intentionally, not randomly

### Phase 6: Proactive Intake
Goal: find work automatically.

Possible sources:
- meeting notes
- bug trackers
- monitor alerts
- git TODO backlog
- review comments

Success criteria:
- orchestrator can propose/spawn tasks from trusted sources
- all proactive work still enters registry and verification flow

## Practical Advice For Your Setup

- Start with 1 to 2 concurrent agents, not 5.
- Prefer deterministic monitors over LLM polling loops.
- Keep business context in OpenClaw memory/knowledge, not inside every coding prompt.
- Never give broad prod write access to coding agents.
- Make "definition of done" explicit before spawning agents.
- Track retries and outcomes so prompt quality improves over time.

## Risks And Caveats

- Resource pressure: multiple worktrees and test runs can exhaust RAM quickly.
- Review automation can create false confidence if not paired with real CI.
- Prompt retry logic can become noisy unless failure categories are structured.
- Unbounded proactive spawning can create chaos without strict registry discipline.

## Recommended Next Move In This Workspace

Implement the smallest useful version first:
- registry
- launcher
- monitor
- done contract

Only after that add:
- retries
- reviewer fan-out
- proactive task discovery

## If User Asks To Build This Here

Translate article into concrete deliverables:
1. add swarm registry schema
2. add launcher script
3. add monitor script
4. wire dashboard visibility
5. define done criteria
6. add retry/re-steer hooks
7. add notifications

Do not start with full parallel swarm complexity. Build the control plane first.
