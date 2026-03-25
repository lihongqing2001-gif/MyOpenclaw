#!/usr/bin/env bash
set -euo pipefail

CALENDAR_NAME="个人"
PREFIX="Life Block"

osascript <<'APPLESCRIPT'
set calName to "个人"
set prefix to "Life Block"

set nowDate to (current date)
set year of nowDate to (year of (current date))
set month of nowDate to (month of (current date))
set day of nowDate to (day of (current date))
set hours of nowDate to 0
set minutes of nowDate to 0
set seconds of nowDate to 0
set startOfDay to nowDate
set endOfDay to startOfDay + (24 * hours)

tell application "Calendar"
  tell calendar calName
    set oldEvents to (every event whose summary starts with prefix and start date ≥ startOfDay and start date < endOfDay)
    repeat with ev in oldEvents
      delete ev
    end repeat

    set block1Start to startOfDay + (9 * hours)
    set block1End to startOfDay + (11 * hours)
    make new event with properties {summary:(prefix & " 09:00-11:00"), start date:block1Start, end date:block1End}

    set block2Start to startOfDay + (14 * hours)
    set block2End to startOfDay + (16 * hours)
    make new event with properties {summary:(prefix & " 14:00-16:00"), start date:block2Start, end date:block2End}

    set block3Start to startOfDay + (20 * hours)
    set block3End to startOfDay + (21 * hours)
    make new event with properties {summary:(prefix & " 20:00-21:00"), start date:block3Start, end date:block3End}
  end tell
end tell
APPLESCRIPT
