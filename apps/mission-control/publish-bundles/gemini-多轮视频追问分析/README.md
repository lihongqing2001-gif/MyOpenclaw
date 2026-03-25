# Gemini 多轮视频追问分析

## Overview

- Capability ID: `cap.openclaw.sop.gemini-21ce414b`
- Node ID: `sop-gemini-多轮视频追问分析`
- Domain: 社交媒体与内容
- Area: 内容洞察
- Source: /Users/liumobei/.openclaw/workspace/sops/gemini_video_multiturn_analysis.md

## Summary

针对一个本地视频文件，在同一个 Gemini 会话里先上传视频，再结合 transcript 连续追问多个细化问题，最终形成一份高价值单条视频深拆报告。

## Inputs

- 本地视频路径
- 输出目录（可选）
- 模型（可选，默认 `gemini-3-pro`）
- transcript 路径（可选）
- 追问轮次 JSON（可选）
- rounds profile（可选，默认 `deep-video-analysis-v1`）
- 最大轮次（可选）

## Bundled Capabilities

- `cap.openclaw.skill.baoyu-danger-gemini-web` · baoyu-danger-gemini-web
- `cap.openclaw.skill.douyin-video` · douyin-video
- `cap.openclaw.skill.remotion-video-production` · remotion-video-production
- `cap.openclaw.skill.alex-session-wrap-up` · session-wrap-up
- `cap.openclaw.skill.video-production` · video-production
- `cap.openclaw.skill.video-prompting-guide` · video-prompting-guide
- `cap.openclaw.skill.videoagent-video-studio` · videoagent-video-studio

## External Dependencies

- None

## Commands

- `python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_gemini_video_multiturn_analysis.py --video-path <本地视频路径>`

## Install On Another OpenClaw

1. Unzip the package.
2. Run `python3 install.py`.
3. If the installer reports missing dependencies, install them one by one according to the list.
4. Run `python3 healthcheck.py`.
5. Start your resident OpenClaw agent and execute the packaged SOP from the new workspace.
