# SOP: 本地视频 Gemini 增强分析

- Capability ID: cap.openclaw.sop.gemini-25ee7d23
- Node ID: sop-本地视频-gemini-增强分析
- Domain: 社交媒体与内容
- Area: 内容洞察

## Summary
针对一个已经落地到本地的视频文件，自动抽取关键帧，调用 Gemini Web 做细粒度内容拆解，并把增强分析报告写回该视频对应的交付目录。

## Preconditions
`baoyu-danger-gemini-web` 已完成 consent 与登录；`bun` 可用；`ffmpeg` / `ffprobe` 可用；视频文件可读

## Inputs
- 本地视频路径 (optional)
- 标题（可选） (optional)
- 输出目录（可选） (optional)
- 额外分析要求（可选） (optional)

## Commands
- `python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_gemini_video_enhanced_analysis.py --video-path <本地视频路径>`

## Required Capabilities
- `cap.openclaw.skill.baoyu-danger-gemini-web` · baoyu-danger-gemini-web · bundled
- `cap.openclaw.skill.douyin-video` · douyin-video · bundled
- `cap.openclaw.skill.remotion-video-production` · remotion-video-production · bundled
- `cap.openclaw.skill.video-production` · video-production · bundled
- `cap.openclaw.skill.video-prompting-guide` · video-prompting-guide · bundled
- `cap.openclaw.skill.videoagent-video-studio` · videoagent-video-studio · bundled

## Use Cases
- “用 Gemini 细拆这个本地视频”: 针对一个已经落地到本地的视频文件，自动抽取关键帧，调用 Gemini Web 做细粒度内容拆解，并把增强分析报告写回该视频对应的交付目录。
- “帮我把这个视频做增强分析”: 针对一个已经落地到本地的视频文件，自动抽取关键帧，调用 Gemini Web 做细粒度内容拆解，并把增强分析报告写回该视频对应的交付目录。
- “对这个落地视频做导演级拆解”: 针对一个已经落地到本地的视频文件，自动抽取关键帧，调用 Gemini Web 做细粒度内容拆解，并把增强分析报告写回该视频对应的交付目录。
