# ML-20260309-OpenClaw-Framework-Stage1

## Goal
建立可持续的 OpenClaw 主框架：能力包标准化、SOP 依赖联动、App 握手拉取、CLI 一键安装与升级。

## Scope
- 能力包规范（manifest/说明/安装/健康检查/版本）
- CLI 一键安装（无障碍）
- App 端拉取技能树与状态（API + SSE）
- SOP 依赖映射与自动解锁规则
- 自动归档/整理 SOP 产出

## Milestones
1) 定义能力包规范 v0.1
2) 定义 CLI 安装/升级流程 v0.1
3) 定义 App 握手与数据结构 v0.1
4) 定义 SOP 依赖联动规则 v0.1

## Current Status
- 用户确认能力包来源：现有技能目录打包
- 安装方式：CLI 一键安装
- App 握手模式：App 拉取 OpenClaw
- 主线命名与索引规则已确定

## Next Steps
- 产出能力包规范草案（capability-manifest.json）
- 产出 CLI 安装/升级流程草案
- 产出握手 API + SSE 数据契约草案
- 产出 SOP 依赖联动草案

## Blockers
- 无

## Change Log
- 2026-03-09: 建立主线任务并确认方向
- 2026-03-09: 选定方案C（ClawHub/索引发布，cap.<org>.<domain>.<name> 命名）
