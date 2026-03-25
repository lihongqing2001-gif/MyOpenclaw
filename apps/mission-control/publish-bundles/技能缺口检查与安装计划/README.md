# 技能缺口检查与安装计划

## Overview

- Capability ID: `cap.openclaw.sop.workflow-9fe1238c`
- Node ID: `sop-技能缺口检查与安装计划`
- Domain: OpenClaw Workflow
- Area: 综合工作流
- Source: /Users/liumobei/.openclaw/workspace/sops/skill_gap_install_plan.md

## Summary

针对一个目标 SOP 或目标任务，检查当前缺少哪些技能、能力包或集成，并输出安装与验证计划。

## Inputs

- 目标 SOP 名称或节点 ID
- 目标自动化等级

## Bundled Capabilities

- `cap.openclaw.skill.find-skills` · find-skills

## External Dependencies

- None

## Commands

- Workflow-driven execution

## Install On Another OpenClaw

1. Unzip the package.
2. Run `python3 install.py`.
3. If the installer reports missing dependencies, install them one by one according to the list.
4. Run `python3 healthcheck.py`.
5. Start your resident OpenClaw agent and execute the packaged SOP from the new workspace.
