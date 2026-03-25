# SOP: 邮件每日分诊与 Telegram 推送

- Capability ID: cap.openclaw.sop.telegram-4567deb0
- Node ID: sop-邮件每日分诊与-telegram-推送
- Domain: 个人管理
- Area: 沟通与邮件

## Summary
每天自动读取一个已保存的邮箱账户档案，只抓新增/未处理邮件，产出一份分诊报告，并优先通过 OpenClaw 已连通的 WhatsApp 主通道把待你拍板的重点推送给你。

## Preconditions
已在“邮件收件箱摘要与优先级整理”里保存过至少一个邮箱账户档案；若 WhatsApp 主通道已连通，优先直接走 `openclaw message send --channel whatsapp`；若主通道不可用，再回退到 `openclaw-watchdog/.env` 中的既有 notifier 配置；当前阶段默认只做观察与建议，不自动回复、不自动删除

## Inputs
- 邮箱账户档案 (optional)
- 通知通道（可选覆盖） (optional)
- 邮箱范围 (optional)
- 时间窗口 (optional)
- 是否需要只看未读 (optional)
- 是否需要只看未处理 (optional)
- 最大邮件数 (optional)
- 推送模式 (optional)

## Commands
- `python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_email_daily_triage.py --email-profile <邮箱账户档案> --notify-channel <通知通道（可选覆盖）> --mailbox-scope <邮箱范围> --time-window <时间窗口> --unread-only <是否需要只看未读> --only-unprocessed <是否需要只看未处理> --max-messages <最大邮件数> --push-mode <推送模式>`

## Required Capabilities
- `cap.openclaw.skill.assistant-orchestrator` · assistant-orchestrator · bundled
- `cap.openclaw.skill.email-sequence` · email-sequence · bundled
- `cap.openclaw.integration.openclaw-notifier` · OpenClaw notifier（WhatsApp / Telegram / Discord / Feishu） · external

## Use Cases
- “今天邮件里有哪些要我处理”: 每天自动读取一个已保存的邮箱账户档案，只抓新增/未处理邮件，产出一份分诊报告，并优先通过 OpenClaw 已连通的 WhatsApp 主通道把待你拍板的重点推送给你。
- “把今天新邮件推送到 WhatsApp 给我决策”: 每天自动读取一个已保存的邮箱账户档案，只抓新增/未处理邮件，产出一份分诊报告，并优先通过 OpenClaw 已连通的 WhatsApp 主通道把待你拍板的重点推送给你。
- “做一轮每日邮件分诊”: 每天自动读取一个已保存的邮箱账户档案，只抓新增/未处理邮件，产出一份分诊报告，并优先通过 OpenClaw 已连通的 WhatsApp 主通道把待你拍板的重点推送给你。
