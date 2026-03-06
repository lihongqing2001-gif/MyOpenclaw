#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

WS="/Users/liumobei/.openclaw/workspace"
HELPER="$WS/scripts/memo_write_from_template.sh"
LOG="$WS/agents/reviews/life-assistant-daily-journal.log"
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
  echo "Daily Summary ${DATE}"
  echo ""
  echo "今日完成："
  echo "- "
  echo ""
  echo "明日计划："
  echo "- "
  echo ""
  echo "待跟进（Reminders/OpenClaw）："
  if [ -n "$REMINDERS" ]; then
    echo "$REMINDERS"
  else
    echo "(无)"
  fi
  echo ""
  echo "习惯打卡："
  echo "- "
  echo ""
  echo "数据统计："
  echo "- 完成率："
  echo "- 拖延点："
  echo "- 习惯完成率："
  echo ""
  echo "反思/提升（只抓1个）："
  echo "- "
} > "$TMP"

MEMO_TEMPLATE_PATH="$TMP" EDITOR="$HELPER" memo notes -a --folder "$FOLDER" >> "$LOG" 2>&1

rm -f "$TMP"
/usr/bin/printf '%s\n' "- ${TS} | daily_journal=ok" >> "$LOG"
