# 邮件收件箱摘要与优先级整理

## Overview

- Capability ID: `cap.openclaw.sop.workflow-c9523b0a`
- Node ID: `sop-邮件收件箱摘要与优先级整理`
- Domain: 个人管理
- Area: 沟通与邮件
- Source: /Users/liumobei/.openclaw/workspace/sops/email_inbox_digest.md

## Summary

自动整理邮箱中的新增邮件，输出一份可执行的收件箱摘要。

## Inputs

- 邮箱地址
- IMAP 主机
- IMAP 端口
- 用户名
- 应用专用密码或授权令牌
- 邮箱范围
- 时间窗口
- 是否需要只看未读

## Bundled Capabilities

- `cap.openclaw.skill.assistant-orchestrator` · assistant-orchestrator
- `cap.openclaw.skill.email-sequence` · email-sequence
- `cap.openclaw.skill.web-search-plus` · web-search-plus

## External Dependencies

- None

## Commands

- `python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_email_inbox_digest.py --email-address <邮箱地址> --imap-host <IMAP 主机> --imap-port <IMAP 端口> --username <用户名> --app-password <应用专用密码或授权令牌> --mailbox-scope <邮箱范围> --time-window <时间窗口> --unread-only <是否需要只看未读>`

## Install On Another OpenClaw

1. Unzip the package.
2. Run `python3 install.py`.
3. If the installer reports missing dependencies, install them one by one according to the list.
4. Run `python3 healthcheck.py`.
5. Start your resident OpenClaw agent and execute the packaged SOP from the new workspace.
