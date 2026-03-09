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
1) 定义能力包规范 v0.2
2) 定义 CLI 安装/升级流程 v0.2
3) 定义 App 握手与数据结构 v0.2
4) 定义 SOP 依赖联动规则 v0.2

## Current Status
- v0.2 规范草案已生成
- 命名方案：cap.<org>.<domain>.<name>
- 发布方案：ClawHub/索引服务

## Next Steps
- 输出 capability-manifest.json 示例包
- 定义 registry 索引样例
- 生成 CLI 原型伪代码
- 产出 task evidence 模板

## Blockers
- 无

## Change Log
- 2026-03-09: 建立主线任务并确认方向
- 2026-03-09: 选定方案C（ClawHub/索引发布，cap.<org>.<domain>.<name> 命名）
- 2026-03-09: v0.2 规范草案完成
