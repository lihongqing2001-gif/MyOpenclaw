# OpenClaw Bundle Instructions

This package contains the SOP `项目书/任务书/手册编写（含技术路线/方法学整理）` as capability `cap.openclaw.sop.content-research-docs`.

## Required Behavior

- Install with `python3 install.py`
- Validate with `python3 healthcheck.py`
- Refuse silent execution if external dependencies are missing
- Report missing permissions or missing capabilities to the user one by one

## Bundled Capabilities

- None

## External Dependencies

- `cap.openclaw.foundation.files-repo` · 文件与版本管理
- `cap.openclaw.foundation.knowledge-index` · 知识库归档与标签

## Execution Contract

- Use `sops/` as the human-readable workflow source
- Use `scripts/` when available
- Read `dependency-hints.json` before asking for missing installs
- Write outputs under `outputs/<capability>/<sop>/<timestamp>/` when the runtime supports it
