# 服务异常排查与恢复建议

## Overview

- Capability ID: `cap.openclaw.sop.workflow-9a809a15`
- Node ID: `sop-服务异常排查与恢复建议`
- Domain: OpenClaw Workflow
- Area: 综合工作流
- Source: /Users/liumobei/.openclaw/workspace/sops/ops_incident_triage.md

## Summary

在服务异常、页面打不开、任务卡死、健康检查异常时，快速形成一份排查与恢复建议。

## Inputs

- 服务地址或服务名
- 现象描述
- 日志路径（可选）

## Bundled Capabilities

- None

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
