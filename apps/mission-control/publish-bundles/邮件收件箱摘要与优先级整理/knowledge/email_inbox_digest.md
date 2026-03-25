# SOP: 邮件收件箱摘要与优先级整理

## Goal
自动整理邮箱中的新增邮件，输出一份可执行的收件箱摘要。

## Default Trigger
- “帮我总结邮件”
- “看看今天邮箱里有什么重要的”
- “整理收件箱优先级”

## Inputs
- 邮箱地址
- IMAP 主机
- IMAP 端口
- 用户名
- 应用专用密码或授权令牌
- 邮箱范围
- 时间窗口
- 是否需要只看未读

## Required Skills
- Email / IMAP integration
- assistant-orchestrator
- web-search-plus

## Preconditions
- 邮箱已授权
- 已知 IMAP 主机与端口
- 允许读取邮件标题和正文摘要

## Output Contract
- `outputs/邮件摘要_<日期>.md`

至少包含：
- 高优先级邮件
- 待回复邮件
- 待归档邮件
- 建议动作

## Steps
1) 拉取指定时间窗口邮件
2) 按重要性和是否需要回复分类
3) 输出摘要与优先级

## Failure Handling
- 如果邮箱未授权，先输出授权缺口
- 如果无法读取正文，至少基于主题与发件人做初筛
