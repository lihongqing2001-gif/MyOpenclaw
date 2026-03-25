# Antfarm

Build your agent team in OpenClaw with one command.

## Summary
Antfarm provides a team of specialized AI agents (planner, developer, verifier, tester, reviewer) that run deterministic workflows to produce repeatable outcomes (feature dev, security audit, bug fix). It installs from GitHub, uses YAML + SQLite + cron, and runs on the same host as OpenClaw.

## Install
```bash
curl -fsSL https://raw.githubusercontent.com/snarktank/antfarm/v0.5.1/scripts/install.sh | bash
```
Or tell OpenClaw: `install github.com/snarktank/antfarm`

## Requirements
- Node.js >= 22
- OpenClaw v2026.2.9+ on host
- gh CLI for PR creation steps

## Workflows
### feature-dev (7 agents)
plan → setup → implement → verify → test → PR → review

### security-audit (7 agents)
scan → prioritize → setup → fix → verify → test → PR

### bug-fix (6 agents)
triage → investigate → setup → fix → verify → PR

## Why It Works
- Deterministic workflows (same steps each run)
- Agents verify each other
- Fresh context for each step
- Retry + escalation

## How It Works
- Define agents/steps in YAML (persona + workspace + acceptance criteria)
- Install provisions agent workspaces, cron polling, subagent permissions
- Run: agents poll, claim steps, pass context; SQLite tracks state

## Dashboard
```bash
antfarm dashboard       # start on port 3333
antfarm dashboard stop  # stop
antfarm dashboard status
```

## Core Commands
```bash
antfarm install
antfarm uninstall [--force]

antfarm workflow list
antfarm workflow install <id>
antfarm workflow uninstall <id>
antfarm workflow run <id> <task>
antfarm workflow status <query>
antfarm workflow runs
antfarm workflow resume <run-id>

antfarm logs [<lines>]
```

## Security Notes
- Official repo only: snarktank/antfarm
- Workflows reviewed for prompt injection
- Everything is plain YAML/Markdown for auditability
