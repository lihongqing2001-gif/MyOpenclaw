# OpenClaw Bundle Instructions

This package contains the SOP `平台热点选题雷达` as capability `cap.openclaw.sop.workflow-8e7d89ea`.

## Required Behavior

- Install with `python3 install.py`
- Validate with `python3 healthcheck.py`
- Refuse silent execution if external dependencies are missing
- Report missing permissions or missing capabilities to the user one by one

## Bundled Capabilities

- `cap.openclaw.skill.assistant-orchestrator` · assistant-orchestrator
- `cap.openclaw.skill.social-content` · social-content
- `cap.openclaw.skill.web-search-plus` · web-search-plus
- `cap.openclaw.skill.xiaohongshu-skills` · xiaohongshu-skills

## External Dependencies

- `cap.openclaw.integration.skill` · 抖音数据抓取/趋势分析 skill

## Execution Contract

- Use `sops/` as the human-readable workflow source
- Use `scripts/` when available
- Read `dependency-hints.json` before asking for missing installs
- Write outputs under `outputs/<capability>/<sop>/<timestamp>/` when the runtime supports it
