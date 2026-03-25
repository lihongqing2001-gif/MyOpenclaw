# OpenClaw Bundle Instructions

This package contains the SOP `邮件每日分诊与 Telegram 推送` as capability `cap.openclaw.sop.telegram-4567deb0`.

## Required Behavior

- Install with `python3 install.py`
- Validate with `python3 healthcheck.py`
- Refuse silent execution if external dependencies are missing
- Report missing permissions or missing capabilities to the user one by one

## Bundled Capabilities

- `cap.openclaw.skill.assistant-orchestrator` · assistant-orchestrator
- `cap.openclaw.skill.email-sequence` · email-sequence

## External Dependencies

- `cap.openclaw.integration.openclaw-notifier` · OpenClaw notifier（WhatsApp / Telegram / Discord / Feishu）

## Execution Contract

- Use `sops/` as the human-readable workflow source
- Use `scripts/` when available
- Read `dependency-hints.json` before asking for missing installs
- Write outputs under `outputs/<capability>/<sop>/<timestamp>/` when the runtime supports it
