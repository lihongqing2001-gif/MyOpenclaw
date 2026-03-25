# 多平台内容改写包

## Overview

- Capability ID: `cap.openclaw.sop.workflow-4fd5a428`
- Node ID: `sop-小红书内容多平台改写包`
- Domain: 社交媒体与内容
- Area: 内容改写
- Source: /Users/liumobei/.openclaw/workspace/sops/xhs_content_repurpose_pack.md

## Summary

把一份已有素材或一篇已有成品，改写成多平台可直接发布的内容包。

## Inputs

- 源材料路径或正文
- 目标平台
- 风格要求
- 输出数量

## Bundled Capabilities

- `cap.openclaw.skill.social-content` · social-content

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
