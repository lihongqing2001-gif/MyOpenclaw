# OpenClaw Bundle Instructions

This package contains the SOP `自动整理归档` as capability `cap.openclaw.sop.content-project-file-organize`.

## Required Behavior

- Install with `python3 install.py`
- Validate with `python3 healthcheck.py`
- Refuse silent execution if external dependencies are missing
- Report missing permissions or missing capabilities to the user one by one

## Bundled Capabilities

- None

## External Dependencies

- `cap.openclaw.foundation.files-repo` · 文件与版本管理

## Execution Contract

- Use `sops/` as the human-readable workflow source
- Use `scripts/` when available
- Read `dependency-hints.json` before asking for missing installs
- Write outputs under `outputs/<capability>/<sop>/<timestamp>/` when the runtime supports it
