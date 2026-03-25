# SOP: 邮件每日分诊与 Telegram 推送

## Goal
每天自动读取一个已保存的邮箱账户档案，只抓新增/未处理邮件，产出一份分诊报告，并优先通过 OpenClaw 已连通的 WhatsApp 主通道把待你拍板的重点推送给你。

## Default Trigger
- “今天邮件里有哪些要我处理”
- “把今天新邮件推送到 WhatsApp 给我决策”
- “做一轮每日邮件分诊”

## Inputs
- 邮箱账户档案
- 通知通道（可选覆盖）
- 邮箱范围
- 时间窗口
- 是否需要只看未读
- 是否需要只看未处理
- 最大邮件数
- 推送模式

## Required Skills
- Email / IMAP integration
- OpenClaw notifier（WhatsApp / Telegram / Discord / Feishu）
- assistant-orchestrator

## Preconditions
- 已在“邮件收件箱摘要与优先级整理”里保存过至少一个邮箱账户档案
- 若 WhatsApp 主通道已连通，优先直接走 `openclaw message send --channel whatsapp`
- 若主通道不可用，再回退到 `openclaw-watchdog/.env` 中的既有 notifier 配置
- 当前阶段默认只做观察与建议，不自动回复、不自动删除

## Output Contract
- `outputs/email-daily-triage/<账户>/YYYY-MM-DD__triage.md`
- `outputs/email-daily-triage/<账户>/YYYY-MM-DD__triage.json`

至少包含：
- 待你拍板
- 建议归档
- 疑似垃圾
- 规则建设建议

## Steps
1) 读取已保存的邮箱账户档案
2) 拉取指定窗口内的新邮件，并默认过滤已分诊过的 UID
3) 依据规则与启发式做分诊
4) 输出本地报告与机器 JSON
5) 若 watchdog notifier 已配置，则发送今日待拍板摘要

## Failure Handling
- 如果账户档案不存在，提示先完成邮箱账户初始化
- 如果 notifier 未配置，仍生成本地报告，但明确写明未完成推送
- 如果邮箱连接失败，输出阻塞说明并停止
