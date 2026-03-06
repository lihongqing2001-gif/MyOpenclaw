#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

WS="/Users/liumobei/.openclaw/workspace"
HELPER="$WS/scripts/memo_write_from_template.sh"
LOG="$WS/agents/reviews/life-assistant-plan-update.log"
TS="$(date '+%Y-%m-%d %H:%M:%S %z')"
DATE="$(date '+%Y-%m-%d')"
TIME="$(date '+%H:%M')"
FOLDER="日记"

mkdir -p "$WS/agents/reviews"

REMINDERS=""
if command -v remindctl >/dev/null 2>&1; then
  REMINDERS=$(remindctl list OpenClaw --plain --no-input --no-color 2>/dev/null || true)
fi

TMP=$(mktemp)
{
  echo "Daily Plan Update ${DATE} ${TIME}"
  echo ""
  echo "突发/调整："
  echo "- "
  echo ""
  echo "当前优先级："
  echo "- "
  echo "- "
  echo "- "
  echo ""
  echo "空闲时补充："
  echo "- 现在有空吗？"
  echo "- 需要安排点工作吗？"
  echo ""
  echo "待跟进（Reminders/OpenClaw）："
  if [ -n "$REMINDERS" ]; then
    echo "$REMINDERS"
  else
    echo "(无)"
  fi
} > "$TMP"

MEMO_TEMPLATE_PATH="$TMP" EDITOR="$HELPER" memo notes -a --folder "$FOLDER" >> "$LOG" 2>&1

"$WS/scripts/life_assistant_calendar_blocks.sh" >> "$LOG" 2>&1

rm -f "$TMP"
/usr/bin/printf '%s\n' "- ${TS} | plan_update=ok" >> "$LOG"
