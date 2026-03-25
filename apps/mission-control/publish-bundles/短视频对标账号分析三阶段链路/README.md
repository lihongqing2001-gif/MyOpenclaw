# 短视频对标账号分析三阶段链路

## Overview

- Capability ID: `cap.openclaw.sop.workflow-60e58f7e`
- Node ID: `sop-短视频对标账号分析三阶段链路`
- Domain: 社交媒体与内容
- Area: 内容洞察
- Source: /Users/liumobei/.openclaw/workspace/sops/short_video_account_benchmark_pipeline.md

## Summary

围绕一个真实对标账号，把多条视频先采成 raw 证据层，再并行做单视频 Gemini 深拆，最后汇总成真正可用的账号分析包。

## Inputs

- sample_manifest.json
- deep_analysis_batch.json

## Bundled Capabilities

- `cap.openclaw.skill.baoyu-danger-gemini-web` · baoyu-danger-gemini-web
- `cap.openclaw.skill.douyin-video` · douyin-video
- `cap.openclaw.skill.remotion-video-production` · remotion-video-production
- `cap.openclaw.skill.alex-session-wrap-up` · session-wrap-up
- `cap.openclaw.skill.social-content` · social-content
- `cap.openclaw.skill.video-production` · video-production
- `cap.openclaw.skill.video-prompting-guide` · video-prompting-guide
- `cap.openclaw.skill.videoagent-video-studio` · videoagent-video-studio

## External Dependencies

- None

## Commands

- `python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_short_video_account_raw_collect.py --manifest-path <sample_manifest.json>`
- `python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_short_video_account_deep_analysis.py --manifest-path <sample_manifest.json>`
- `python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_short_video_account_synthesis.py --manifest-path <sample_manifest.json> --deep-batch-path <deep_analysis_batch.json>`

## Install On Another OpenClaw

1. Unzip the package.
2. Run `python3 install.py`.
3. If the installer reports missing dependencies, install them one by one according to the list.
4. Run `python3 healthcheck.py`.
5. Start your resident OpenClaw agent and execute the packaged SOP from the new workspace.
