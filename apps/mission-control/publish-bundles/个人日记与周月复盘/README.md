# 个人日记与周月复盘

## Overview

- Capability ID: `cap.openclaw.sop.content-diary-review`
- Node ID: `sop-content-diary-review`
- Domain: 个人管理
- Area: 日志与复盘
- Source: /Users/liumobei/.openclaw/workspace/content_system/skilltree/data.json

## Summary

自我复盘、目标追踪、情绪与习惯记录

## Inputs

- 内容

## Bundled Capabilities

- None

## External Dependencies

- `cap.openclaw.foundation.files-repo` · 文件与版本管理
  install: `read/write/edit/exec + git`
- `cap.openclaw.foundation.knowledge-index` · 知识库归档与标签
  install: `/knowledge ingest --domain <领域> --platform <平台>`

## Commands

- `/journal daily --summary <内容>`

## Install On Another OpenClaw

1. Unzip the package.
2. Run `python3 install.py`.
3. If the installer reports missing dependencies, install them one by one according to the list.
4. Run `python3 healthcheck.py`.
5. Start your resident OpenClaw agent and execute the packaged SOP from the new workspace.
