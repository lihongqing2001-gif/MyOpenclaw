---
name: ios-task-sync
description: "Sync user tasks and reminders to iOS via Apple Reminders (remindctl) and calendar events (gog for Google Calendar when configured). Use when user asks to add tasks, to-dos, reminders, or calendar items that should appear on iPhone/iPad."
---

# iOS Task Sync

Use this skill to push user tasks into iOS-visible systems.

## Default Routing

- If user says “待办/提醒/任务” and wants it on iOS → Apple Reminders via `remindctl`.
- If user says “日历/会议/事件/预约” → ask which calendar provider:
  - Google Calendar → use `gog` calendar.
  - Apple Calendar → if `gog` not available, offer to store as Reminder with date/time.

## Reminders Workflow (remindctl)

1) List available lists and create a dedicated list if needed.
2) Add reminders with title + due time.
3) Confirm creation and return IDs.

Commands:

```bash
remindctl list
remindctl list OpenClaw --create
remindctl add --title "<title>" --list OpenClaw --due "YYYY-MM-DD HH:mm"
```

## Calendar Workflow (gog)

If Google Calendar is approved and configured:

1) Ask for calendar name if not provided.
2) Create event with start/end time, title, location, notes.
3) Report event ID and time.

Use `gog calendar` commands per the gog skill.

## Confirmation Questions (only if needed)

Ask exactly one question if any of these are missing:
- List name (for reminders)
- Date/time (for reminders or calendar)
- Calendar provider (Apple vs Google)

## Reporting

Return a concise summary:
- What was created
- Where it was created (list/calendar)
- When it will trigger
- IDs or handles if available
