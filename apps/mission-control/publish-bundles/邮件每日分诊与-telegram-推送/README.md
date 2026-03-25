# 邮件每日分诊与 Telegram 推送

## Overview

- Capability ID: `cap.openclaw.sop.telegram-4567deb0`
- Node ID: `sop-邮件每日分诊与-telegram-推送`
- Domain: 个人管理
- Area: 沟通与邮件
- Source: /Users/liumobei/.openclaw/workspace/sops/email_daily_triage_push.md

## Summary

每天自动读取一个已保存的邮箱账户档案，只抓新增/未处理邮件，产出一份分诊报告，并优先通过 OpenClaw 已连通的 WhatsApp 主通道把待你拍板的重点推送给你。

## Inputs

- 邮箱账户档案
- 通知通道（可选覆盖）
- 邮箱范围
- 时间窗口
- 是否需要只看未读
- 是否需要只看未处理
- 最大邮件数
- 推送模式

## Bundled Capabilities

- `cap.openclaw.skill.assistant-orchestrator` · assistant-orchestrator
- `cap.openclaw.skill.email-sequence` · email-sequence

## External Dependencies

- `cap.openclaw.integration.openclaw-notifier` · OpenClaw notifier（WhatsApp / Telegram / Discord / Feishu）

## Commands

- `python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_email_daily_triage.py --email-profile <邮箱账户档案> --notify-channel <通知通道（可选覆盖）> --mailbox-scope <邮箱范围> --time-window <时间窗口> --unread-only <是否需要只看未读> --only-unprocessed <是否需要只看未处理> --max-messages <最大邮件数> --push-mode <推送模式>`

## Install On Another OpenClaw

1. Unzip the package.
2. Run `python3 install.py`.
3. If the installer reports missing dependencies, install them one by one according to the list.
4. Run `python3 healthcheck.py`.
5. Start your resident OpenClaw agent and execute the packaged SOP from the new workspace.
