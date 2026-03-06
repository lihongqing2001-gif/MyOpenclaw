#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

WS="/Users/liumobei/.openclaw/workspace"
HELPER="$WS/scripts/memo_write_from_template.sh"
LOG="$WS/agents/reviews/life-assistant-daily-plan.log"
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
  echo "Daily Plan ${DATE}"
  echo ""
  echo "今日三件事："
  echo "- "
  echo "- "
  echo "- "
  echo ""
  echo "拒绝清单（今天不做）："
  echo "- "
  echo "- "
  echo ""
  echo "收集箱（新想法/杂事先放这里）："
  echo "- "
  echo ""
  echo "任务拆分（25-45分钟）："
  echo "- "
  echo "- "
  echo ""
  echo "会议/沟通前目标（一句话）："
  echo "- "
  echo ""
  echo "时间块："
  echo "- 09:00-11:00 "
  echo "- 14:00-16:00 "
  echo "- 20:00-21:00 "
  echo ""
  echo "突发调整："
  echo "- "
  echo ""
  echo "习惯打卡："
  echo "- 运动："
  echo "- 阅读："
  echo "- 睡眠："
  echo "- 饮食："
  echo "- 专注："
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
/usr/bin/printf '%s\n' "- ${TS} | daily_plan=ok" >> "$LOG"
