# 单条内容洞察与入库

## Overview

- Capability ID: `cap.openclaw.sop.workflow-bcea6618`
- Node ID: `sop-抖音单条视频分析与知识入库`
- Domain: 社交媒体与内容
- Area: 内容洞察
- Source: /Users/liumobei/.openclaw/workspace/sops/douyin_single_video_analysis.md

## Summary

针对一条抖音分享链接，解析视频信息、下载视频、提取语音文案，输出一份结构化分析报告，并把结果同时沉淀到长期知识库与长期资产库。 / 针对一条小红书笔记链接，抓取笔记详情和代表性评论，输出一份结构化分析报告，并把结果同时沉淀到长期知识库与长期资产库。。已融合 2 个同类 SOP：抖音单条视频分析与知识入库、小红书单条笔记分析与知识入库

## Inputs

- 抖音分享链接
- 分析目标（可选）
- 项目系列（可选，默认 `AI内容系统`）
- 项目实例（可选，默认 `YYYY-MM__单条内容分析`）
- `API_KEY` 或 `--api-key`（用于语音转写）
- 小红书笔记链接

## Bundled Capabilities

- `cap.openclaw.skill.baoyu-danger-gemini-web` · baoyu-danger-gemini-web
- `cap.openclaw.skill.douyin-video` · douyin-video
- `cap.openclaw.skill.qmd-skill` · qmd
- `cap.openclaw.skill.remotion-video-production` · remotion-video-production
- `cap.openclaw.skill.video-production` · video-production
- `cap.openclaw.skill.video-prompting-guide` · video-prompting-guide
- `cap.openclaw.skill.videoagent-video-studio` · videoagent-video-studio
- `cap.openclaw.skill.xiaohongshu-skills` · xiaohongshu-skills

## External Dependencies

- None

## Commands

- `python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_gemini_video_enhanced_analysis.py --video-path <raw 目录中的 mp4 路径>`
- `python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_gemini_video_multiturn_analysis.py --video-path <raw 目录中的 mp4 路径>`
- `python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_xhs_single_note_analysis.py --note-url <小红书笔记链接>`

## Install On Another OpenClaw

1. Unzip the package.
2. Run `python3 install.py`.
3. If the installer reports missing dependencies, install them one by one according to the list.
4. Run `python3 healthcheck.py`.
5. Start your resident OpenClaw agent and execute the packaged SOP from the new workspace.
