# 版本管理与回溯

## Overview

- Capability ID: `cap.openclaw.sop.content-project-version-trace`
- Node ID: `sop-content-project-version-trace`
- Domain: 项目产出与资料管理
- Area: 文件与资料管理
- Source: /Users/liumobei/.openclaw/workspace/content_system/skilltree/data.json

## Summary

交付追踪、历史回查

## Inputs

- 执行参数

## Bundled Capabilities

- None

## External Dependencies

- `cap.openclaw.foundation.files-repo` · 文件与版本管理
  install: `read/write/edit/exec + git`

## Commands

- Workflow-driven execution

## Install On Another OpenClaw

1. Unzip the package.
2. Run `python3 install.py`.
3. If the installer reports missing dependencies, install them one by one according to the list.
4. Run `python3 healthcheck.py`.
5. Start your resident OpenClaw agent and execute the packaged SOP from the new workspace.
