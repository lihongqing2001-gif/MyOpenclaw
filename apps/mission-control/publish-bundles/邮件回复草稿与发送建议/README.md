# 邮件回复草稿与发送建议

## Overview

- Capability ID: `cap.openclaw.sop.workflow-8c040ba6`
- Node ID: `sop-邮件回复草稿与发送建议`
- Domain: 个人管理
- Area: 日程规划与提醒
- Source: /Users/liumobei/.openclaw/workspace/sops/email_reply_drafter.md

## Summary

针对一封或一组邮件生成可直接使用的回复草稿，并给出发送建议。

## Inputs

- 邮件主题或邮件 ID
- 回复目标
- 回复语气

## Bundled Capabilities

- `cap.openclaw.skill.assistant-orchestrator` · assistant-orchestrator
- `cap.openclaw.skill.email-sequence` · email-sequence

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
