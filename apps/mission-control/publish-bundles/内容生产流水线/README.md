# 内容生产流水线

## Overview

- Capability ID: `cap.openclaw.sop.content-content-pipeline`
- Node ID: `sop-content-content-pipeline`
- Domain: 社交媒体与内容
- Area: 发布与复盘
- Source: /Users/liumobei/.openclaw/workspace/content_system/skilltree/data.json

## Summary

日更内容、选题实验、风格迭代

## Inputs

- 执行参数

## Bundled Capabilities

- `cap.openclaw.skill.social-content` · social-content

## External Dependencies

- `cap.openclaw.foundation.messaging` · WhatsApp 推送与通知
  install: `message.send`
- `cap.openclaw.foundation.cron-jobs` · 定时任务编排
  install: `cron.add / cron.update`
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
