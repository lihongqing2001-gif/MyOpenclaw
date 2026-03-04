# RECOVERY_PLAYBOOK.md

## Goal
Restore controllability and continuity when session drifts, slows down, or loses state linkage.

## Step 1: Freeze and Snapshot
1. Stop spawning new tasks.
2. Write checkpoint file in `agents/reviews/checkpoint-*.md`.
3. Append durable facts to `memory/YYYY-MM-DD.md`.

## Step 2: Rebuild Ground Truth
1. Read latest checkpoint + daily memory.
2. Read dashboard state from:
   - `/api/main-tasks`
   - `/api/tasks/active`
   - `/api/timeline`
3. Reconcile in-flight subagent sessions with dashboard tasks.

## Step 3: Repair Linkage
1. For missing in-flight tasks: `monitor-kit dispatch ...`
2. For completed but open tasks: `monitor-kit complete --request-id ...`
3. Log repair events to timeline.

## Step 4: Health and Channel Validation
1. `curl /api/health`
2. `openclaw channels status --probe --json`
3. If WA disconnected, run WA recovery checklist.

## Step 5: Resume in Controlled Mode
1. Enforce max 2 concurrent subagents.
2. Require acceptance proof for each closeout.
3. Report concise status to user: done/risk/next.

## Emergency Safe Mode
If repeated drift or contradiction occurs:
- stop delegation,
- only perform verification and reporting,
- ask user for one-by-one execution until stable.
