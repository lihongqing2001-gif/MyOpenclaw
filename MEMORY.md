# MEMORY

## 2026-03-05
- Archived old main session transcript and summaries:
  - `archive/old-main-main.jsonl`
  - `archive/old-main-main-extracts.md`
  - `archive/old-main-main-summary.md`

## 2026-03-06
- WhatsApp main session transcript at `agents/main/sessions/e3c65313-44f0-4972-827d-74478be17f05.jsonl` reviewed and integrated.
- AgentTeam mechanism confirmed in policy/runtime docs; standard delegation loop retained (plan → dispatch → verify → report).
- Updated AgentTeam task template fields in `agents/policy/SOP_TASK_TEMPLATE.md` and committed.
- Recovery rule: on restart, use `sessions_list` to locate the latest WhatsApp main session and read its `transcriptPath` to restore current memory; prefer the most recent WhatsApp session over archived `old-main-*` unless explicitly requested.
- Current WhatsApp main session transcript path (latest): `agents/main/sessions/507c3acb-fbb7-4f51-a392-9c164cdd9ced.jsonl`.
- Five current mainline tasks captured with priority order defined by user; proceed one-by-one with stage plans, delegated execution, and acceptance-driven run-throughs.
- User schedule: wake 07:40, sleep 24:00 (used for morning reminders).
- 默认提醒由 life-assistant（秘书）发送，主会话仅转述指令；提醒消息需带【助理】前缀。

## 2026-03-07
- 已安装 `find-skills` 技能（via `npx skills add https://github.com/vercel-labs/skills --skill find-skills`）；以后遇到“怎么做 X / 有没有对应 skill / 能不能扩展这个能力 / 找工具或工作流”时，先自动调用 `find-skills` 再决定是否推荐或安装技能。
- 用户要求永久记住：网络搜索优先使用 `web-search-plus` 技能。
- 用户要求：以后他说“用这个”时，直接自动安装并集成对应工具/仓库。
- 用户要求深刻记忆：以后所有日程、提醒、计划整理默认交给助理处理。
- 涉及日历同步时默认使用 Apple（日历/提醒事项），无需再次确认。

## 2026-03-17
- 用户已安装 `subagent-driven-development` skill（`npx skills add https://github.com/obra/superpowers --skill subagent-driven-development`）；以后多子任务、并行开发、分工收尾类任务默认优先按该 skill 的方式完成。
- 用户要求把 OpenClaw 作为编排层 + 编码代理群（agent swarm）的文章方法纳入知识库；后续讨论多代理编排、任务注册、监控、PR 验证、重试引导时，优先参考 `agents/knowledge/knowledge-base/openclaw-agent-swarm-setup.md`。
