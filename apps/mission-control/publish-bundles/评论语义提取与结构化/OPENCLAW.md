# OpenClaw Bundle Instructions

This package contains the SOP `评论语义提取与结构化` as capability `cap.openclaw.sop.xiaohongshu-comment-semantic-extraction-auto-excel`.

## Required Behavior

- Install with `python3 install.py`
- Validate with `python3 healthcheck.py`
- Refuse silent execution if external dependencies are missing
- Report missing permissions or missing capabilities to the user one by one

## Bundled Capabilities

- `cap.openclaw.skill.journal-revision-workflow` · journal-revision-workflow
- `cap.openclaw.skill.self-improving` · Self-Improving Agent (With Self-Reflection)
- `cap.openclaw.skill.alex-session-wrap-up` · session-wrap-up
- `cap.openclaw.skill.social-content` · social-content
- `cap.openclaw.skill.xiaohongshu-skills` · xiaohongshu-skills

## External Dependencies

- None

## Execution Contract

- Use `sops/` as the human-readable workflow source
- Use `scripts/` when available
- Read `dependency-hints.json` before asking for missing installs
- Write outputs under `outputs/<capability>/<sop>/<timestamp>/` when the runtime supports it
