# 项目书/任务书/手册编写（含技术路线/方法学整理）

## Overview

- Capability ID: `cap.openclaw.sop.content-research-docs`
- Node ID: `sop-content-research-docs`
- Domain: 项目产出与资料管理
- Area: 科研
- Source: /Users/liumobei/.openclaw/workspace/content_system/skilltree/data.json

## Summary

科研任务书、项目书、手册

## Inputs

- 执行参数

## Bundled Capabilities

- None

## External Dependencies

- `cap.openclaw.foundation.files-repo` · 文件与版本管理
  install: `read/write/edit/exec + git`
- `cap.openclaw.foundation.knowledge-index` · 知识库归档与标签
  install: `/knowledge ingest --domain <领域> --platform <平台>`

## Commands

- Workflow-driven execution

## Install On Another OpenClaw

1. Unzip the package.
2. Run `python3 install.py`.
3. If the installer reports missing dependencies, install them one by one according to the list.
4. Run `python3 healthcheck.py`.
5. Start your resident OpenClaw agent and execute the packaged SOP from the new workspace.
