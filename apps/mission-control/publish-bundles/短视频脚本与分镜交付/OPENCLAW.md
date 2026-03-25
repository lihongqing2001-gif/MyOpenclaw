# OpenClaw Bundle Instructions

This package contains the SOP `短视频脚本与分镜交付` as capability `cap.openclaw.sop.workflow-7d8ef248`.

## Required Behavior

- Install with `python3 install.py`
- Validate with `python3 healthcheck.py`
- Refuse silent execution if external dependencies are missing
- Report missing permissions or missing capabilities to the user one by one

## Bundled Capabilities

- `cap.openclaw.skill.ai-image-generation` · ai-image-generation
- `cap.openclaw.skill.assistant-orchestrator` · assistant-orchestrator
- `cap.openclaw.skill.remotion-best-practices` · remotion-best-practices
- `cap.openclaw.skill.remotion-video-production` · remotion-video-production
- `cap.openclaw.skill.vercel-react-best-practices` · vercel-react-best-practices

## External Dependencies

- None

## Execution Contract

- Use `sops/` as the human-readable workflow source
- Use `scripts/` when available
- Read `dependency-hints.json` before asking for missing installs
- Write outputs under `outputs/<capability>/<sop>/<timestamp>/` when the runtime supports it
