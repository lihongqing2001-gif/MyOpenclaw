# OpenClaw Bundle Instructions

This package contains the SOP `趋势信号与观点池` as capability `cap.openclaw.sop.x-01186f69`.

## Required Behavior

- Install with `python3 install.py`
- Validate with `python3 healthcheck.py`
- Refuse silent execution if external dependencies are missing
- Report missing permissions or missing capabilities to the user one by one

## Bundled Capabilities

- `cap.openclaw.skill.assistant-orchestrator` · assistant-orchestrator
- `cap.openclaw.skill.social-content` · social-content
- `cap.openclaw.skill.web-search-plus` · web-search-plus

## External Dependencies

- `cap.openclaw.integration.x-twitter-skill` · X / Twitter 搜索或抓取 skill

## Execution Contract

- Use `sops/` as the human-readable workflow source
- Use `scripts/` when available
- Read `dependency-hints.json` before asking for missing installs
- Write outputs under `outputs/<capability>/<sop>/<timestamp>/` when the runtime supports it
