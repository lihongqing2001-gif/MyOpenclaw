# 本地视频 Gemini 增强分析

## Overview

- Capability ID: `cap.openclaw.sop.gemini-25ee7d23`
- Node ID: `sop-本地视频-gemini-增强分析`
- Domain: 社交媒体与内容
- Area: 内容洞察
- Source: /Users/liumobei/.openclaw/workspace/sops/gemini_video_enhanced_analysis.md

## Summary

针对一个已经落地到本地的视频文件，自动抽取关键帧，调用 Gemini Web 做细粒度内容拆解，并把增强分析报告写回该视频对应的交付目录。

## Inputs

- 本地视频路径
- 标题（可选）
- 输出目录（可选）
- 额外分析要求（可选）

## Bundled Capabilities

- `cap.openclaw.skill.baoyu-danger-gemini-web` · baoyu-danger-gemini-web
- `cap.openclaw.skill.douyin-video` · douyin-video
- `cap.openclaw.skill.remotion-video-production` · remotion-video-production
- `cap.openclaw.skill.video-production` · video-production
- `cap.openclaw.skill.video-prompting-guide` · video-prompting-guide
- `cap.openclaw.skill.videoagent-video-studio` · videoagent-video-studio

## External Dependencies

- None

## Commands

- `python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_gemini_video_enhanced_analysis.py --video-path <本地视频路径>`

## Install On Another OpenClaw

1. Unzip the package.
2. Run `python3 install.py`.
3. If the installer reports missing dependencies, install them one by one according to the list.
4. Run `python3 healthcheck.py`.
5. Start your resident OpenClaw agent and execute the packaged SOP from the new workspace.
