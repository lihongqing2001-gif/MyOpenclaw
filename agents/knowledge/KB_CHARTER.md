# Our Knowledge Charter

Owner: 董事长 + 中枢

## Purpose
Build a reusable knowledge system for OpenClaw operations, delivery, and troubleshooting.

## Rules
- Write only from real execution and verified read-back.
- Separate long-term knowledge from temporary chat context.
- Every failure must produce a postmortem + prevention action.
- Every stable success should produce a reusable snippet.

## Cadence
- Daily: append execution facts to `agents/reviews/retro-YYYYMMDD.md`.
- Daily digest: run `agents/evolution/RUN_DAILY_DIGEST.sh`.
- Weekly: promote high-value items from L4 -> L2/L1.

## Definition of Done
A knowledge item is done when it has:
1) context, 2) exact commands, 3) expected output, 4) rollback/fix path.
