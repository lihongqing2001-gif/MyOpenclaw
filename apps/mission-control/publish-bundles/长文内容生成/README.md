# 长文内容生成

## Overview

- Capability ID: `cap.openclaw.sop.content-content-writer`
- Node ID: `sop-content-content-writer`
- Domain: 社交媒体与内容
- Area: 内容生产
- Source: /Users/liumobei/.openclaw/workspace/content_system/skilltree/data.json

## Summary

AI/创业/教育/生活方式等多领域内容产出

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

- `/content run --style xiaogai --count 1`

## Install On Another OpenClaw

1. Unzip the package.
2. Run `python3 install.py`.
3. If the installer reports missing dependencies, install them one by one according to the list.
4. Run `python3 healthcheck.py`.
5. Start your resident OpenClaw agent and execute the packaged SOP from the new workspace.
