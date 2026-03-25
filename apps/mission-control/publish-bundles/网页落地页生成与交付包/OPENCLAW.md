# OpenClaw Bundle Instructions

This package contains the SOP `网页落地页生成与交付包` as capability `cap.openclaw.sop.workflow-1dcf62c4`.

## Required Behavior

- Install with `python3 install.py`
- Validate with `python3 healthcheck.py`
- Refuse silent execution if external dependencies are missing
- Report missing permissions or missing capabilities to the user one by one

## Bundled Capabilities

- `cap.openclaw.skill.ai-image-generation` · ai-image-generation
- `cap.openclaw.skill.assistant-orchestrator` · assistant-orchestrator
- `cap.openclaw.skill.frontend-design` · frontend-design
- `cap.openclaw.skill.penpot-uiux-design` · penpot-uiux-design
- `cap.openclaw.skill.video-prompting-guide` · video-prompting-guide
- `cap.openclaw.skill.web-design-guidelines` · web-design-guidelines

## External Dependencies

- None

## Execution Contract

- Use `sops/` as the human-readable workflow source
- Use `scripts/` when available
- Read `dependency-hints.json` before asking for missing installs
- Write outputs under `outputs/<capability>/<sop>/<timestamp>/` when the runtime supports it
