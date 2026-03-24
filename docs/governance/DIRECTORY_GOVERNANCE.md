# OpenClaw Directory Governance

## Goal

Turn the workspace from a development-evolution repo into a product-maintenance repo.

## Phase 1 Principles

- keep the monorepo for official product code
- move runtime state out of the repo
- move external standalone projects out of the repo
- separate official publishable assets from personal/runtime content
- keep one compatibility round with symlinks

## Runtime Root

Runtime data now belongs under:

- `~/.openclaw/runtime`

Recommended structure:

- `agent/`
- `packages/`
- `monitoring/`
- `temp/`
- `outputs/`
- `logs/`
- `caches/`
- `staged/`
- `artifacts/`

## External Projects Root

Standalone projects now belong under:

- `~/.openclaw/external-projects`

The main repo should only keep archive/index references for them.

## Official Asset Boundary

The repo keeps only official, publishable assets:

- official skills
- official SOPs
- official demos
- official tutorials
- official reference knowledge

Personal notes, runtime notes, temporary cases, and mutable working outputs should not stay in the repo root as first-class directories.
