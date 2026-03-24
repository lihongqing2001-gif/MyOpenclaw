# OpenClaw Web App Parallel Execution Plan

## Current verified status

### Working

- Web app is reachable at `http://127.0.0.1:3000`
- Broker health endpoint responds
- Resident agent can connect and run tasks
- Local document route `/api/v1/doc?path=...` works
- Global knowledge search now includes:
  - seed/runtime knowledge
  - workspace-scanned knowledge
  - qmd search results
- Natural-language placeholder replacement works for commands like:
  - `/calendar plan --window <时间范围> --focus <重点>`
- Runtime case writing works
  - verified output under `agents/knowledge/cases/`
- `qmd update` runs and refreshes the index

### Partially working

- Slash-style OpenClaw tasks can run, but outcomes still depend on upstream OpenClaw agent behavior
- Some content-system nodes are now correctly marked as non-shell workflows, but many still need explicit execution mapping
- Skill requirements are now more conservative, but runtime evidence accumulation has only begun

### Not done yet

- Broad SOP coverage is not complete
- Knowledge archival is not yet comprehensive for all success/failure paths
- UI still needs deeper refinement around:
  - task result interpretation
  - knowledge result grouping
  - stronger affordances for executable vs non-executable SOPs
- Human-facing docs are outdated in a few places

### Parallel analysis highlights

- Most level-3 nodes are still descriptive workflows rather than deterministic executors.
- A task being marked `completed` is not yet equivalent to “the promised artifact was produced”.
- The knowledge model is still mixed:
  - seed mock data
  - scanned docs
  - runtime knowledge
  - qmd wrappers
  This needs canonical IDs and evidence levels.
- Productization is still source-oriented:
  - build exists
  - production package and one-command bootstrap still need finishing

---

## Parallel workstreams

The work should proceed in four tracks in parallel.

## Track A — SOP Execution Reliability

### Goal

Increase the number of SOPs that can run end-to-end with real outcomes.

### Immediate tasks

1. Inventory all Level 3 SOP nodes and classify them into:
   - runnable shell/python/npm/claw command
   - runnable slash/OpenClaw task
   - descriptive workflow with no executable mapping

2. For each descriptive workflow, decide one of:
   - convert to explicit command
   - convert to `__OPENCLAW_WORKFLOW__` execution
   - mark read-only with explanation

3. Add stronger completion semantics for slash/OpenClaw runs:
   - success only when output is operationally useful
   - partial success when advice is returned instead of deliverable
   - failure when upstream provider or auth blocks execution

4. Add per-SOP runtime adapters for the highest-value nodes:
   - `自动整理归档`
   - `资料清单化与索引`
   - `小盖风格内容生成（厚版）`
   - `Xiaohongshu Comment Semantic Extraction (Auto Excel)`

### Files

- `openclaw_agent.py`
- `src/server/skillTreeLoader.ts`
- `src/components/GlassDrawer.tsx`
- `server.ts`

### Success criteria

- Every Level 3 node has a clear execution mode
- Descriptive nodes no longer fail with shell `127`
- High-value SOPs either run successfully or fail with an explicit actionable reason

---

## Track B — Knowledge and Learning System

### Goal

Make runtime learning first-class and qmd-indexed.

### Immediate tasks

1. Expand runtime knowledge writing:
   - success -> `agents/knowledge/cases/`
   - failure -> `agents/knowledge/runtime-lessons/`
   - reusable skill guidance -> `agents/knowledge/skills/`
   - SOP execution guidance -> `agents/knowledge/sops/`

2. Add stronger metadata to written Markdown:
   - evidence level
   - node id
   - skill ids used
   - source paths
   - output artifacts
   - known limitations

3. Make `qmd update` part of every successful write path

4. Add optional `qmd embed` queueing for new high-value documents

5. Expose evidence levels in the UI:
   - declared
   - runtime
   - confirmed

### Files

- `openclaw_agent.py`
- `src/server/knowledgeLoader.ts`
- `server.ts`
- `src/types/index.ts`

### Success criteria

- Running a SOP produces durable knowledge
- New knowledge appears in search without restart
- Search results can distinguish reference docs from runtime cases

---

## Track C — Skill Requirement Accuracy

### Goal

Replace guessed requirements with real evidence.

### Immediate tasks

1. Keep only these requirement sources:
   - explicit declared dependencies
   - explicit text references
   - runtime evidence

2. Stop deriving requirements from loose semantic guesses

3. Persist runtime skill evidence per node

4. Re-rank displayed requirements by confidence:
   - confirmed
   - runtime
   - declared

5. Add UI labels showing evidence source

### Files

- `src/server/skillTreeLoader.ts`
- `openclaw_agent.py`
- `server.ts`
- `src/components/GlassDrawer.tsx`

### Success criteria

- No more obviously imagined skill requirements
- Requirements shown in the UI can be defended by a clear evidence source

---

## Track D — Productization and Operability

### Goal

Turn the current app into a more stable packaged control console.

### Immediate tasks

1. Finish packaging outputs:
   - build artifact
   - zip package
   - desktop manual

2. Align docs with actual behavior:
   - remove stale 3D role references
   - document new knowledge route
   - document runtime case writing
   - document executable vs descriptive SOP behavior

3. Improve UI operability:
   - clickable knowledge results
   - clearer executable-state badges
   - grouped search results
   - fewer dead controls

4. Add launch verification script:
   - broker health
   - doc route
   - skill-tree route
   - agent heartbeat

### Files

- `README.md`
- `APP_FUNCTIONS.md`
- `OPENCLAW_INSTRUCTIONS.md`
- `KNOWLEDGE_SYSTEM_DESIGN.md`
- desktop manual output

### Success criteria

- A user can launch, inspect, and operate the app without tribal knowledge
- Docs reflect real behavior

---

## Recommended execution order

These tracks can run mostly in parallel, but there is one practical dependency order.

### First

- Track A
- Track B

Reason:
- execution and learning must stabilize together

### Second

- Track C

Reason:
- real runtime evidence from A/B improves requirement accuracy

### Third

- Track D

Reason:
- packaging and docs should describe the stabilized behavior, not a moving target

---

## Suggested task ownership split

If parallelized across workers:

- Worker 1: execution reliability
- Worker 2: knowledge/qmd system
- Worker 3: UI/docs/productization

This keeps write surfaces mostly separate:

- Worker 1
  - `openclaw_agent.py`
  - `server.ts`

- Worker 2
  - `src/server/knowledgeLoader.ts`
  - `src/server/skillTreeLoader.ts`
  - `src/types/index.ts`

- Worker 3
  - `src/components/GlassDrawer.tsx`
  - `src/App.tsx`
  - docs and packaging files

---

## Current next best move

The highest-leverage next step is:

1. finish Track A for the top 3–5 SOPs
2. make Track B write both success and failure notes consistently
3. then use those runtime artifacts to tighten Track C

That will convert the app from “partially wired console” into a system that improves from its own executions.
