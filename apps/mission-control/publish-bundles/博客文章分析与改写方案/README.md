# 博客文章分析与改写方案

## Overview

- Capability ID: `cap.openclaw.sop.workflow-c62a80e1`
- Node ID: `sop-博客文章分析与改写方案`
- Domain: 社交媒体与内容
- Area: 内容采集
- Source: /Users/liumobei/.openclaw/workspace/sops/blog_analysis_pack.md

## Summary

对一篇博客文章做结构、观点、风格与可传播性分析，并输出改写建议或多平台转化方案。

## Inputs

- 博客链接或文章正文
- 分析目标
- 是否要改写

## Bundled Capabilities

- `cap.openclaw.skill.assistant-orchestrator` · assistant-orchestrator
- `cap.openclaw.skill.frontend-design` · frontend-design
- `cap.openclaw.skill.penpot-uiux-design` · penpot-uiux-design
- `cap.openclaw.skill.web-design-guidelines` · web-design-guidelines
- `cap.openclaw.skill.web-search-plus` · web-search-plus

## External Dependencies

- None

## Commands

- Workflow-driven execution

## Install On Another OpenClaw

1. Unzip the package.
2. Run `python3 install.py`.
3. If the installer reports missing dependencies, install them one by one according to the list.
4. Run `python3 healthcheck.py`.
5. Start your resident OpenClaw agent and execute the packaged SOP from the new workspace.
