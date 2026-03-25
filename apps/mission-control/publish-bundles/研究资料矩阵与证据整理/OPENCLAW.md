# OpenClaw Bundle Instructions

This package contains the SOP `研究资料矩阵与证据整理` as capability `cap.openclaw.sop.workflow-ff3ad013`.

## Required Behavior

- Install with `python3 install.py`
- Validate with `python3 healthcheck.py`
- Refuse silent execution if external dependencies are missing
- Report missing permissions or missing capabilities to the user one by one

## Bundled Capabilities

- `cap.openclaw.skill.qmd-skill` · qmd
- `cap.openclaw.skill.social-content` · social-content
- `cap.openclaw.skill.web-search-plus` · web-search-plus

## External Dependencies

- None

## Execution Contract

- Use `sops/` as the human-readable workflow source
- Use `scripts/` when available
- Read `dependency-hints.json` before asking for missing installs
- Write outputs under `outputs/<capability>/<sop>/<timestamp>/` when the runtime supports it
