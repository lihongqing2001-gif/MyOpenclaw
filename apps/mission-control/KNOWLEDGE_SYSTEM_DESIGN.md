# OpenClaw Knowledge System Design

## Goal

Make OpenClaw genuinely learn while running, write what it learns into a structured knowledge base, index that knowledge with `qmd`, and feed the results back into the Web console in a form that is searchable, inspectable, and operationally useful.

This design assumes the current environment already has:

- `qmd` installed at `/Users/liumobei/.bun/bin/qmd`
- Existing knowledge directories under:
  - `/Users/liumobei/.openclaw/workspace/agents/knowledge`
  - `/Users/liumobei/.openclaw/workspace/content_system`

## Current Reality

### What already exists

- The Web console can render:
  - skill tree
  - SOP drawers
  - task state
  - knowledge search results
- Runtime knowledge can already be pushed back through broker SSE.
- `qmd` is already configured with collections:
  - `agents-knowledge`
  - `content-knowledge`

### What is still missing

- Runtime learning is not yet written to durable Markdown knowledge files.
- `qmd` indexing is not triggered automatically after each useful run.
- Skill install guidance, SOP usage guidance, and case studies are not all backed by the real knowledge base.
- There is not yet a strict distinction between:
  - declared knowledge
  - runtime evidence
  - confirmed best practice

## Design Principles

1. Knowledge must be file-first.
   The source of truth should be Markdown documents on disk, not transient in-memory objects.

2. Runtime learning must create new artifacts.
   A successful or failed run should produce a knowledge record when it teaches something reusable.

3. `qmd` is the indexing layer, not the authoring layer.
   OpenClaw writes Markdown; `qmd` indexes and retrieves it.

4. UI should only show evidence-backed knowledge.
   The console should prioritize knowledge that is declared, runtime-observed, or user-confirmed.

5. Search should be progressive.
   Use fast lexical search first, then vector/hybrid search only when needed.

## Knowledge Types

The system should maintain 5 knowledge classes.

### 1. Skill Reference

What a skill is, how to install it, how to use it, what prerequisites it has.

Source:

- `skills/*/SKILL.md`
- `skills/*/README.md`
- runtime confirmation that a skill was actually used

### 2. SOP Reference

How an SOP is supposed to work, required inputs, expected outputs, common triggers, commands.

Source:

- `sops/*.md`
- `content_system/skilltree/data.json`

### 3. Case Study

A real task execution that succeeded and is worth reusing as an example.

Source:

- runtime task completion
- output files
- execution summary

### 4. Runtime Lesson

Something learned from failure, repair, or workaround.

Examples:

- a node looked executable but only had descriptive text
- a command needed placeholder extraction from URL
- a certain skill was not truly required despite being previously assumed

### 5. Confirmed Best Practice

A pattern promoted after repeated success or explicit user confirmation.

This is the highest-confidence class of knowledge.

## Directory Structure

Use the existing `agents/knowledge` tree and extend it.

Recommended structure:

```text
/Users/liumobei/.openclaw/workspace/agents/knowledge
├── README.md
├── KB_CHARTER.md
├── L0-overview/
├── L1-playbooks/
├── L2-runbooks/
├── L3-postmortems/
├── L4-snippets/
├── skills/
│   ├── xiaohongshu-skills.md
│   ├── qmd-skill.md
│   └── ...
├── sops/
│   ├── xhs_comment_semantic_extract.md
│   └── ...
├── cases/
│   ├── 2026-03-18-xhs-comment-extract-success.md
│   └── ...
├── runtime-lessons/
│   ├── 2026-03-18-descriptive-workflow-not-executable.md
│   └── ...
└── confirmed/
    ├── xhs-comment-extract-operational-pattern.md
    └── ...
```

## Evidence Levels

Every knowledge item should carry one of these evidence levels:

- `declared`
  from SKILL.md / SOP docs / content_system data

- `runtime`
  inferred from actual execution context or observed command usage

- `confirmed`
  explicitly approved by user or promoted after repeated success

UI display priority should be:

`confirmed > runtime > declared`

## Runtime Learning Pipeline

For every task run:

1. Claim task
2. Resolve inputs
3. Execute
4. Capture:
   - final command
   - cwd
   - source path
   - actual used skills
   - stdout/stderr excerpt
   - success/failure
   - output artifacts
5. Decide whether it produced reusable knowledge
6. Write Markdown knowledge file(s)
7. Trigger `qmd update`
8. Optionally trigger `qmd embed` for items that need semantic retrieval
9. Push `knowledge upsert` SSE event
10. UI reflects changes live

## What should be learned from runtime

OpenClaw should learn these things automatically when possible:

### Skill usage truth

If a run succeeds using only:

- `xiaohongshu-skills`

then the node should store that as runtime evidence.

If a previously assumed skill was not used, it should not be promoted.

### Input normalization patterns

Example:

- A Xiaohongshu URL can be converted into `feed_id` and `xsec_token`

This should become a reusable runtime lesson.

### Failure causes

Example:

- descriptive workflow text was mistaken for a shell command

This should become a postmortem/runtime lesson.

### Output contract

Example:

- a given SOP produces a final Excel on Desktop

This should be captured in a case study after success.

## Markdown Template

### Skill Reference

```md
---
id: skill-xiaohongshu-skills
type: skill
evidence: declared
skill_id: xiaohongshu-skills
updated_at: 2026-03-18T16:00:00+08:00
---

# xiaohongshu-skills

## Install
`claw skill install xiaohongshu-skills`

## Purpose
...

## Commands
...

## Docs
...
```

### SOP Reference

```md
---
id: sop-xhs-comment-semantic-extract
type: sop
evidence: declared
sop_id: xhs_comment_semantic_extract
updated_at: 2026-03-18T16:00:00+08:00
---

# Xiaohongshu Comment Semantic Extraction

## Inputs
...

## Preconditions
...

## Commands
...

## Expected Outputs
...
```

### Runtime Lesson

```md
---
id: lesson-2026-03-18-descriptive-workflow-not-executable
type: runtime-lesson
evidence: runtime
updated_at: 2026-03-18T16:00:00+08:00
related_nodes:
  - sop-content-project-file-organize
---

# Descriptive Workflow Was Mistaken for an Executable Command

## Problem
...

## Symptom
...

## Fix
...

## Future Rule
...
```

### Case Study

```md
---
id: case-2026-03-18-xhs-comment-extract
type: case
evidence: runtime
updated_at: 2026-03-18T16:00:00+08:00
related_nodes:
  - sop-xiaohongshu-comment-semantic-extraction-auto-excel
skills:
  - xiaohongshu-skills
---

# Xiaohongshu Comment Extraction Case

## Input
...

## Execution
...

## Output
...

## What worked
...
```

## `qmd` Collections

Use the existing collections, but expand them.

Recommended collections:

```bash
qmd collection add /Users/liumobei/.openclaw/workspace/agents/knowledge --name agents-knowledge --mask "**/*.md"
qmd collection add /Users/liumobei/.openclaw/workspace/content_system --name content-knowledge --mask "**/*.md"
```

Optional future split:

- `kb-skills`
- `kb-sops`
- `kb-cases`
- `kb-runtime`

For now, using the two existing collections is simpler and good enough.

## Search Strategy

### Fast path

Use:

```bash
qmd search "query" -c agents-knowledge
qmd search "query" -c content-knowledge
```

This should be the default for interactive use.

### Semantic fallback

If lexical search fails:

```bash
qmd vsearch "query" -c agents-knowledge
```

### Hybrid search

Only use when really needed:

```bash
qmd query "query"
```

## Auto-indexing Strategy

### After every knowledge write

Run:

```bash
qmd update
```

### Nightly embedding refresh

Run:

```bash
qmd embed
```

only for new or changed items that need semantic search.

## UI Integration

The Web console should use the knowledge base in 4 places.

### 1. Global Knowledge Search

Should search across:

- skill docs
- SOP docs
- runtime lessons
- case studies
- confirmed best practices

### 2. Skill Module Details

When user clicks a skill module, show:

- install command
- docs link
- usage guidance from knowledge base
- example case links

### 3. SOP Drawer

Should show:

- how to use this SOP
- required skills
- real case studies
- known pitfalls / runtime lessons
- links to source docs

### 4. Search Results

Each result should show:

- title
- summary
- type
- evidence level
- source link
- optional example link

## Automatic Archival

“Auto archive” should mean:

- write durable Markdown
- classify it into the correct folder
- refresh qmd index

not:

- only storing a transient runtime object

## Promotion Rules

Do not immediately promote runtime observations into confirmed best practice.

Promote only when:

- repeated success count reaches a threshold
- user explicitly approves
- a lesson is manually reviewed

## Implementation Roadmap

### Phase 1

- Write runtime knowledge Markdown after task completion/failure
- Run `qmd update`
- Surface richer search results in the UI

### Phase 2

- Add runtime lesson extraction
- Add case study generation
- Add evidence-level display in UI

### Phase 3

- Add promotion workflow from runtime -> confirmed
- Add `qmd embed` refresh pipeline
- Add knowledge freshness indicators in UI

## Practical Next Step

The best first implementation step is:

1. After each task, write a Markdown file to `agents/knowledge/cases/` or `agents/knowledge/runtime-lessons/`
2. Run `qmd update`
3. Include those documents in `/api/v1/knowledge/search`

That alone will immediately make the knowledge base:

- more complete
- more grounded in actual runtime
- searchable with `qmd`
- useful for skills, SOP guidance, and case display
