# 文献检索与引用整理

## Overview

- Capability ID: `cap.openclaw.sop.content-research-literature`
- Node ID: `sop-content-research-literature`
- Domain: 项目产出与资料管理
- Area: 科研
- Source: /Users/liumobei/.openclaw/workspace/content_system/skilltree/data.json

## Summary

综述写作、资料支撑

## Inputs

- 执行参数

## Bundled Capabilities

- None

## External Dependencies

- `cap.openclaw.foundation.web-search` · 搜索与网页抓取
  install: `web_search / web_fetch`
- `cap.openclaw.foundation.knowledge-index` · 知识库归档与标签
  install: `/knowledge ingest --domain <领域> --platform <平台>`
- `cap.openclaw.foundation.browser-ops` · 网页浏览与采集
  install: `浏览器快照/点击/抓取`

## Commands

- Workflow-driven execution

## Install On Another OpenClaw

1. Unzip the package.
2. Run `python3 install.py`.
3. If the installer reports missing dependencies, install them one by one according to the list.
4. Run `python3 healthcheck.py`.
5. Start your resident OpenClaw agent and execute the packaged SOP from the new workspace.
