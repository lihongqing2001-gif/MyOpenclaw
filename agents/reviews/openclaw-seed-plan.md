# OpenClaw Seed Plan (v1)

## Goal
Build a clean, reproducible "seed package" that can restore a fresh OpenClaw instance to equivalent capabilities with minimal manual steps.

## Scope
Include:
- Core config (`openclaw.json`, channel settings templates, model policy)
- Skills and SOPs (`skills/`, custom scripts, checklists)
- Agent conventions (`AGENTS.md`, `SOUL.md`, `USER.md` template, `TOOLS.md`)
- Knowledge base (`agents/knowledge/`, curated docs, stable snippets)
- Recovery/runbook (`bootstrap/restore.sh`, verification checklist)

Exclude:
- Logs, transient runtime state, task execution traces, caches, pid/db lock files
- Sensitive secrets (use `.env.example` + placeholder mapping)

## Package Layout
seed/
- manifest.json
- VERSION
- checksums.sha256
- config/
- skills/
- agents/
- docs/
- scripts/
  - build-seed.sh
  - restore-seed.sh
  - verify-seed.sh
- templates/
  - env.example

## Build Pipeline
1. Collect allowlisted paths.
2. Strip denylisted artifacts (logs/cache/runtime/db temp).
3. Normalize paths and permissions.
4. Generate manifest (file list + capability tags + source commit).
5. Create checksum file.
6. Archive as `openclaw-seed-YYYYMMDD-HHMM.tar.gz`.

## Restore Pipeline
1. Validate archive checksum.
2. Extract into fresh workspace.
3. Materialize configs from templates.
4. Run dependency/install bootstrap.
5. Run environment probes and smoke tests.
6. Output readiness report (pass/fail + missing items).

## Auto-Alignment (Continuous Evolution)
- Trigger seed rebuild on:
  - skill changes
  - config changes
  - knowledge base promoted snippets
- Add nightly reconciliation job:
  - compare current capability fingerprint vs latest seed manifest
  - if drift > threshold, open repair task and rebuild seed
- Maintain semantic versioning:
  - MAJOR: incompatible restore changes
  - MINOR: capability additions
  - PATCH: fixes/docs/update only

## Capability Fingerprint (for "equivalent ability")
Define machine-checkable checks:
- Channels reachable
- Core API health endpoints pass
- Required skills discoverable and runnable
- Mission-control critical routes/data readable
- Heartbeat automation alive

Fingerprint stored in `manifest.json` and verified by `verify-seed.sh`.

## Security Rules
- Never package raw secrets; use secret references.
- Secret injection step required at restore time.
- Redact personal data from knowledge export.

## Rollout Phases
Phase 1 (now):
- Freeze package structure + allowlist/denylist + build script skeleton

Phase 2:
- Implement restore + verify scripts
- Add fingerprint checks

Phase 3:
- Add scheduled auto-rebuild + drift detection
- Add release notes/changelog generation

## Acceptance Criteria
- Fresh OpenClaw can restore to "operational" in one command + secrets injection.
- Restore report shows all critical checks green.
- Rebuild process is deterministic from same source commit.
