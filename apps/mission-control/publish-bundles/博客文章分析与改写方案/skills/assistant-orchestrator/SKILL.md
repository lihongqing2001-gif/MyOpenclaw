---
name: assistant-orchestrator
description: Personal assistant operating rules for this workspace. Use when the user asks about schedules, reminders, Apple Notes/Reminders/Calendar syncing, weekly/monthly planning, skill discovery, or OpenClaw agent-swarm orchestration. Also use when the user says the assistant should take over, asks to remember a workflow, or wants rules summarized into an auto-applied skill.
---

# Assistant Orchestrator

Apply these defaults for this workspace.

## Schedule And Reminder Rules

- Treat schedule, reminder, planning, and follow-up work as assistant-owned by default.
- Do not bounce workflow questions back to the user when the next step is obvious.
- Default Apple ecosystem for personal scheduling:
  - Apple Notes for planning surfaces
  - Apple Reminders for due-based follow-up
  - Apple Calendar for time-blocked events
- Use `日程总览（持续更新）` as the single short-term planning hub.
- Do not create a daily report unless explicitly requested.
- Move completed short-term work into weekly/monthly summaries instead of leaving clutter in Notes.
- When details are missing, set a reasonable placeholder structure and mark unknown items as `待确认`.

## Notes Structure

Maintain this shape unless the user changes it:
- `日程总览（持续更新）` = short-term command center
- `周报｜YYYY-Wxx` = weekly closeout
- `月报｜YYYY-MM` = monthly closeout
- Archive noisy or untitled notes instead of leaving them in the main view

## Reminder And Calendar Routing

- Put time-specific events into Apple Calendar.
- Put follow-up tasks and confirmations into Apple Reminders.
- If the user says to handle it later, schedule assistant-owned reminders rather than asking them to remember it.
- When summarizing a week, present the assistant view directly in a friendly tone.

## Skill Discovery Rule

- If the user asks whether a capability exists, how to do a common task, or wants to extend the system, call `find-skills` first.
- Prefer checking for an existing skill before inventing a new workflow.
- If a matching skill exists, summarize what it does and whether it should be installed.

## Swarm / Orchestration Rule

- For OpenClaw multi-agent or coding-swarm requests, think in layers:
  - OpenClaw = orchestration layer
  - coding agents = execution layer
  - CI / review / screenshots / verification = done contract
- Prefer building the control plane before scaling agent count.
- Read `references/swarm-blueprint.md` when implementing or discussing swarm architecture.

## Reporting Style

- Default to: what changed, what was synced, what still needs confirmation.
- For scheduling work, report outcomes rather than exposing every internal step.
- If a user correction establishes a repeatable workflow, treat it as a durable rule for this skill.
