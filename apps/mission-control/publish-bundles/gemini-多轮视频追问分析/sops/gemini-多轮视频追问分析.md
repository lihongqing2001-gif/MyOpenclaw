# SOP: Gemini 多轮视频追问分析

- Capability ID: cap.openclaw.sop.gemini-21ce414b
- Node ID: sop-gemini-多轮视频追问分析
- Domain: 社交媒体与内容
- Area: 内容洞察

## Summary
针对一个本地视频文件，在同一个 Gemini 会话里先上传视频，再结合 transcript 连续追问多个细化问题，最终形成一份高价值单条视频深拆报告。

## Preconditions
`baoyu-danger-gemini-web` 已完成 consent 与登录；`bun` 可用；视频文件可读；允许较长等待时间；如果要自动转写，环境中需要可用的 `OPENAI_API_KEY`

## Inputs
- 本地视频路径 (optional)
- 输出目录（可选） (optional)
- 模型（可选，默认 `gemini-3-pro`） (optional)
- transcript 路径（可选） (optional)
- 追问轮次 JSON（可选） (optional)
- rounds profile（可选，默认 `deep-video-analysis-v1`） (optional)
- 最大轮次（可选） (optional)

## Commands
- `python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_gemini_video_multiturn_analysis.py --video-path <本地视频路径>`

## Required Capabilities
- `cap.openclaw.skill.baoyu-danger-gemini-web` · baoyu-danger-gemini-web · bundled
- `cap.openclaw.skill.douyin-video` · douyin-video · bundled
- `cap.openclaw.skill.remotion-video-production` · remotion-video-production · bundled
- `cap.openclaw.skill.alex-session-wrap-up` · session-wrap-up · bundled
- `cap.openclaw.skill.video-production` · video-production · bundled
- `cap.openclaw.skill.video-prompting-guide` · video-prompting-guide · bundled
- `cap.openclaw.skill.videoagent-video-studio` · videoagent-video-studio · bundled

## Use Cases
- “用 Gemini 在同一个对话里连续分析这个视频”: 针对一个本地视频文件，在同一个 Gemini 会话里先上传视频，再结合 transcript 连续追问多个细化问题，最终形成一份高价值单条视频深拆报告。
- “同一个视频让 Gemini 多轮追问”: 针对一个本地视频文件，在同一个 Gemini 会话里先上传视频，再结合 transcript 连续追问多个细化问题，最终形成一份高价值单条视频深拆报告。
- “先分析视频，再继续追问更多细节”: 针对一个本地视频文件，在同一个 Gemini 会话里先上传视频，再结合 transcript 连续追问多个细化问题，最终形成一份高价值单条视频深拆报告。
