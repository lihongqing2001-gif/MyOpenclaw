# 趋势信号与观点池

## Overview

- Capability ID: `cap.openclaw.sop.x-01186f69`
- Node ID: `sop-x-趋势信号摘要与观点池`
- Domain: 社交媒体与内容
- Area: 内容洞察
- Source: /Users/liumobei/.openclaw/workspace/sops/x_signal_digest.md

## Summary

围绕一个关键词、人物、品牌或行业，持续整理 X 上的热门观点、争议点和可转化内容角度。

## Inputs

- 关键词 / 主题
- 时间范围
- 输出数量
- 是否需要中文转写

## Bundled Capabilities

- `cap.openclaw.skill.assistant-orchestrator` · assistant-orchestrator
- `cap.openclaw.skill.social-content` · social-content
- `cap.openclaw.skill.web-search-plus` · web-search-plus

## External Dependencies

- `cap.openclaw.integration.x-twitter-skill` · X / Twitter 搜索或抓取 skill

## Commands

- Workflow-driven execution

## Install On Another OpenClaw

1. Unzip the package.
2. Run `python3 install.py`.
3. If the installer reports missing dependencies, install them one by one according to the list.
4. Run `python3 healthcheck.py`.
5. Start your resident OpenClaw agent and execute the packaged SOP from the new workspace.
