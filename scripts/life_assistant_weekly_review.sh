#!/usr/bin/env bash
set -euo pipefail

WS="/Users/liumobei/.openclaw/workspace"
HELPER="$WS/scripts/memo_write_from_template.sh"
LOG="$WS/agents/reviews/life-assistant-weekly-review.log"
TS="$(date '+%Y-%m-%d %H:%M:%S %z')"
DATE="$(date '+%Y-%m-%d')"
FOLDER="日记"

mkdir -p "$WS/agents/reviews"

REMINDERS=""
if command -v remindctl >/dev/null 2>&1; then
  REMINDERS=$(remindctl list OpenClaw --plain --no-input --no-color 2>/dev/null || true)
fi

TMP=$(mktemp)
{
  echo "Weekly Review ${DATE}"
  echo ""
  echo "本周完成："
  echo "- "
  echo ""
  echo "本周阻碍："
  echo "- "
  echo ""
  echo "下周重点："
  echo "- "
  echo ""
  echo "习惯统计："
  echo "- 运动："
  echo "- 阅读："
  echo "- 睡眠："
  echo "- 饮食："
  echo "- 专注："
  echo ""
  echo "数据统计："
  echo "- 完成率："
  echo "- 拖延点："
  echo "- 习惯完成率："
  echo ""
  echo "待跟进（Reminders/OpenClaw）："
  if [ -n "$REMINDERS" ]; then
    echo "$REMINDERS"
  else
    echo "(无)"
  fi
} > "$TMP"

MEMO_TEMPLATE_PATH="$TMP" EDITOR="$HELPER" memo notes -a --folder "$FOLDER" >> "$LOG" 2>&1

rm -f "$TMP"
/usr/bin/printf '%s\n' "- ${TS} | weekly_review=ok" >> "$LOG"
