# OpenClaw Bundle Instructions

This package contains the SOP `长文内容生成` as capability `cap.openclaw.sop.content-content-writer`.

## Required Behavior

- Install with `python3 install.py`
- Validate with `python3 healthcheck.py`
- Refuse silent execution if external dependencies are missing
- Report missing permissions or missing capabilities to the user one by one

## Bundled Capabilities

- None

## External Dependencies

- `cap.openclaw.foundation.web-search` · 搜索与网页抓取
- `cap.openclaw.foundation.knowledge-index` · 知识库归档与标签
- `cap.openclaw.foundation.browser-ops` · 网页浏览与采集

## Execution Contract

- Use `sops/` as the human-readable workflow source
- Use `scripts/` when available
- Read `dependency-hints.json` before asking for missing installs
- Write outputs under `outputs/<capability>/<sop>/<timestamp>/` when the runtime supports it
