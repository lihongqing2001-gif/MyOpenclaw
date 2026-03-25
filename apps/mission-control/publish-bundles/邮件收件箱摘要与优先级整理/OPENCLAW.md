# OpenClaw Bundle Instructions

This package contains the SOP `邮件收件箱摘要与优先级整理` as capability `cap.openclaw.sop.workflow-c9523b0a`.

## Required Behavior

- Install with `python3 install.py`
- Validate with `python3 healthcheck.py`
- Refuse silent execution if external dependencies are missing
- Report missing permissions or missing capabilities to the user one by one

## Bundled Capabilities

- `cap.openclaw.skill.assistant-orchestrator` · assistant-orchestrator
- `cap.openclaw.skill.email-sequence` · email-sequence
- `cap.openclaw.skill.web-search-plus` · web-search-plus

## External Dependencies

- None

## Execution Contract

- Use `sops/` as the human-readable workflow source
- Use `scripts/` when available
- Read `dependency-hints.json` before asking for missing installs
- Write outputs under `outputs/<capability>/<sop>/<timestamp>/` when the runtime supports it
