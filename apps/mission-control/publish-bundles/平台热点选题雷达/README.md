# 平台热点选题雷达

## Overview

- Capability ID: `cap.openclaw.sop.workflow-8e7d89ea`
- Node ID: `sop-抖音热点雷达与选题池`
- Domain: 社交媒体与内容
- Area: 内容洞察
- Source: /Users/liumobei/.openclaw/workspace/sops/douyin_topic_radar.md

## Summary

围绕一个主题或账号方向，持续发现抖音近期值得跟进的热点话题，并输出可直接进入内容排期的选题池。 / 围绕一个明确主题或品类，拉取并汇总小红书与外部信号中的热点选题，输出一份可以直接进入内容排期的选题雷达。。已融合 2 个同类 SOP：抖音热点雷达与选题池、小红书选题雷达与热点跟踪

## Inputs

- 主题 / 赛道
- 时间范围
- 输出数量
- 对标账号（可选）
- 是否只要小红书

## Bundled Capabilities

- `cap.openclaw.skill.assistant-orchestrator` · assistant-orchestrator
- `cap.openclaw.skill.social-content` · social-content
- `cap.openclaw.skill.web-search-plus` · web-search-plus
- `cap.openclaw.skill.xiaohongshu-skills` · xiaohongshu-skills

## External Dependencies

- `cap.openclaw.integration.skill` · 抖音数据抓取/趋势分析 skill

## Commands

- Workflow-driven execution

## Install On Another OpenClaw

1. Unzip the package.
2. Run `python3 install.py`.
3. If the installer reports missing dependencies, install them one by one according to the list.
4. Run `python3 healthcheck.py`.
5. Start your resident OpenClaw agent and execute the packaged SOP from the new workspace.
