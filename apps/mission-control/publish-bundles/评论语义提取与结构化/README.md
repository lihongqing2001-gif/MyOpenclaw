# 评论语义提取与结构化

## Overview

- Capability ID: `cap.openclaw.sop.xiaohongshu-comment-semantic-extraction-auto-excel`
- Node ID: `sop-xiaohongshu-comment-semantic-extraction-auto-excel`
- Domain: 社交媒体与内容
- Area: 内容采集
- Source: /Users/liumobei/.openclaw/workspace/sops/xhs_comment_semantic_extract.md

## Summary

For a given Xiaohongshu note link, fetch the full comment area, normalize comment semantics into a single business-ready Excel, and default to this SOP whenever the user asks to crawl a Xiaohongshu link's comments.

## Inputs

- Xiaohongshu note URL
- Output path (optional)
- Batch size (optional)

## Bundled Capabilities

- `cap.openclaw.skill.journal-revision-workflow` · journal-revision-workflow
- `cap.openclaw.skill.self-improving` · Self-Improving Agent (With Self-Reflection)
- `cap.openclaw.skill.alex-session-wrap-up` · session-wrap-up
- `cap.openclaw.skill.social-content` · social-content
- `cap.openclaw.skill.xiaohongshu-skills` · xiaohongshu-skills

## External Dependencies

- None

## Commands

- `python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_xhs_comment_semantic_extract.py --note-url <Xiaohongshu note URL> --output <Output path (optional)> --batch-size <Batch size (optional)>`

## Install On Another OpenClaw

1. Unzip the package.
2. Run `python3 install.py`.
3. If the installer reports missing dependencies, install them one by one according to the list.
4. Run `python3 healthcheck.py`.
5. Start your resident OpenClaw agent and execute the packaged SOP from the new workspace.
