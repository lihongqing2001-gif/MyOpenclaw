# OpenClaw Bundle Instructions

This package contains the SOP `内容生产流水线` as capability `cap.openclaw.sop.content-content-pipeline`.

## Required Behavior

- Install with `python3 install.py`
- Validate with `python3 healthcheck.py`
- Refuse silent execution if external dependencies are missing
- Report missing permissions or missing capabilities to the user one by one

## Bundled Capabilities

- `cap.openclaw.skill.social-content` · social-content

## External Dependencies

- `cap.openclaw.foundation.messaging` · WhatsApp 推送与通知
- `cap.openclaw.foundation.cron-jobs` · 定时任务编排
- `cap.openclaw.foundation.files-repo` · 文件与版本管理

## Execution Contract

- Use `sops/` as the human-readable workflow source
- Use `scripts/` when available
- Read `dependency-hints.json` before asking for missing installs
- Write outputs under `outputs/<capability>/<sop>/<timestamp>/` when the runtime supports it
