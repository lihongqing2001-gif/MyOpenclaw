# OpenClaw Bundle Instructions

This package contains the SOP `Gemini 多轮视频追问分析` as capability `cap.openclaw.sop.gemini-21ce414b`.

## Required Behavior

- Install with `python3 install.py`
- Validate with `python3 healthcheck.py`
- Refuse silent execution if external dependencies are missing
- Report missing permissions or missing capabilities to the user one by one

## Bundled Capabilities

- `cap.openclaw.skill.baoyu-danger-gemini-web` · baoyu-danger-gemini-web
- `cap.openclaw.skill.douyin-video` · douyin-video
- `cap.openclaw.skill.remotion-video-production` · remotion-video-production
- `cap.openclaw.skill.alex-session-wrap-up` · session-wrap-up
- `cap.openclaw.skill.video-production` · video-production
- `cap.openclaw.skill.video-prompting-guide` · video-prompting-guide
- `cap.openclaw.skill.videoagent-video-studio` · videoagent-video-studio

## External Dependencies

- None

## Execution Contract

- Use `sops/` as the human-readable workflow source
- Use `scripts/` when available
- Read `dependency-hints.json` before asking for missing installs
- Write outputs under `outputs/<capability>/<sop>/<timestamp>/` when the runtime supports it
