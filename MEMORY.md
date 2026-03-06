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
