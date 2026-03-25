# SOP: 邮件回复草稿与发送建议

## Goal
针对一封或一组邮件生成可直接使用的回复草稿，并给出发送建议。

## Default Trigger
- “帮我回这封邮件”
- “给这几封邮件写回复草稿”
- “整理成可发送版本”

## Inputs
- 邮件主题或邮件 ID
- 回复目标
- 回复语气

## Required Skills
- Email / IMAP integration
- assistant-orchestrator

## Preconditions
- 邮件可读取
- 如果要自动发送，必须单独授权

## Output Contract
- `outputs/邮件回复草稿_<日期>.md`

至少包含：
- 回复对象
- 回复草稿
- 建议发送时机
- 风险提醒

## Steps
1) 读取原始邮件
2) 提取关键诉求
3) 生成回复草稿
4) 标记是否建议人工复核

## Failure Handling
- 如果邮件上下文不全，先输出草稿框架而不是硬写结论
- 自动发送必须单独确认
