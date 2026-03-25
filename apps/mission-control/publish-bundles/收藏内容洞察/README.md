# 收藏内容洞察

## Overview

- Capability ID: `cap.openclaw.sop.workflow-b3ed9783`
- Node ID: `sop-收藏视频洞察入库`
- Domain: 社交媒体与内容
- Area: 内容洞察
- Source: /Users/liumobei/.openclaw/workspace/sops/saved_video_insight_capture.md

## Summary

针对一条你收藏或转发给系统的短视频链接，生成一份可阅读、可检索、可继续提问的洞察记录，并写入长期资产库与知识库。

## Inputs

- 视频链接
- 收藏原因 / 备注（可选）
- 洞察目标（可选）
- 收藏集合名（可选，默认 `收藏视频`）

## Bundled Capabilities

- `cap.openclaw.skill.douyin-video` · douyin-video
- `cap.openclaw.skill.remotion-video-production` · remotion-video-production
- `cap.openclaw.skill.social-content` · social-content
- `cap.openclaw.skill.video-production` · video-production
- `cap.openclaw.skill.video-prompting-guide` · video-prompting-guide
- `cap.openclaw.skill.videoagent-video-studio` · videoagent-video-studio

## External Dependencies

- None

## Commands

- `python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_saved_video_insight_capture.py --video-url <视频链接>`

## Install On Another OpenClaw

1. Unzip the package.
2. Run `python3 install.py`.
3. If the installer reports missing dependencies, install them one by one according to the list.
4. Run `python3 healthcheck.py`.
5. Start your resident OpenClaw agent and execute the packaged SOP from the new workspace.
