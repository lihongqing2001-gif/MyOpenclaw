# 自动整理归档

## Overview

- Capability ID: `cap.openclaw.sop.content-project-file-organize`
- Node ID: `sop-content-project-file-organize`
- Domain: 项目产出与资料管理
- Area: 文件与资料管理
- Source: /Users/liumobei/.openclaw/workspace/content_system/skilltree/data.json

## Summary

历史资料整理、项目归档

## Inputs

- 目标目录
- 归档规则说明

## Bundled Capabilities

- None

## External Dependencies

- `cap.openclaw.foundation.files-repo` · 文件与版本管理
  install: `read/write/edit/exec + git`

## Commands

- `python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_project_file_organize.py --target-dir <目标目录> --rule <归档规则说明>`

## Install On Another OpenClaw

1. Unzip the package.
2. Run `python3 install.py`.
3. If the installer reports missing dependencies, install them one by one according to the list.
4. Run `python3 healthcheck.py`.
5. Start your resident OpenClaw agent and execute the packaged SOP from the new workspace.
