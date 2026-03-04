---
name: my-skill-installer
description: "Automatically installs a skill, reads its SKILL.md, performs preliminary tests, and generates a report."
metadata:
  openclaw:
    emoji: "📦"
---

# My Skill Installer

This skill automates the process of installing new OpenClaw skills, understanding their functionality, performing initial checks, and generating a concise report.

## Usage

Use the `/install-skill` command to trigger this skill.

### Parameters

- `skill_id`: The slug or GitHub repository URL of the skill to install. (Required)
- `perform_test`: Boolean. Whether to perform preliminary tests after installation. Defaults to `true`.
- `report_format`: String. The desired format for the report (e.g., "markdown", "json"). Defaults to "markdown".

## Commands

### /install-skill

Installs a specified skill and provides a report.

```
/install-skill <skill_id> [--perform_test <boolean>] [--report_format <string>]
```

**Example:**
`/install-skill casual-cron`
`/install-skill https://github.com/arakichanxd/Claw-Sync --perform_test false`
  run: python3 install_skill.py "{{skill_id}}" --perform_test "{{perform_test}}" --report_format "{{report_format}}"

## Workflow

1.  Receives `skill_id`.
2.  Executes `npx clawhub@latest install <skill_id>`, automatically agreeing to security prompts.
3.  Reads the installed skill's `SKILL.md`.
4.  If `perform_test` is true:
    *   Identifies executable scripts and ensures they have execute permissions.
    *   Attempts to run common test commands (e.g., `status`, `help`, `version`, or the script itself without arguments).
    *   Analyzes output for configuration requirements (e.g., environment variables, config files).
5.  Compiles a comprehensive report including:
    *   Skill description.
    *   Installation status.
    *   Key commands and their usage.
    *   Preliminary test results.
    *   Identified configuration needs.
    *   Recommendations for full testing.
6.  Outputs the report in the specified format.
