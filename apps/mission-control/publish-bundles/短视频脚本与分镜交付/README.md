# 短视频脚本与分镜交付

## Overview

- Capability ID: `cap.openclaw.sop.workflow-7d8ef248`
- Node ID: `sop-短视频脚本与分镜交付包`
- Domain: 社交媒体与内容
- Area: 内容生产
- Source: /Users/liumobei/.openclaw/workspace/sops/short_video_storyboard_pack.md

## Summary

围绕一个主题或已有文案，输出一套短视频可执行交付包。

## Inputs

- 主题或源内容
- 平台
- 时长
- 风格

## Bundled Capabilities

- `cap.openclaw.skill.ai-image-generation` · ai-image-generation
- `cap.openclaw.skill.assistant-orchestrator` · assistant-orchestrator
- `cap.openclaw.skill.remotion-best-practices` · remotion-best-practices
- `cap.openclaw.skill.remotion-video-production` · remotion-video-production
- `cap.openclaw.skill.vercel-react-best-practices` · vercel-react-best-practices

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
