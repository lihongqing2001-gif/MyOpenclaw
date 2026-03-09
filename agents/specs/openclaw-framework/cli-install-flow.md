# CLI Install Flow (v0.2)

## Goal
一键安装能力包，确保依赖齐全且健康。

## Commands
- install <capability-id>
- update <capability-id>
- remove <capability-id>
- list
- verify <capability-id>

## Steps (install)
1) 解析 capability-manifest.json 或 registry metadata
2) 检查依赖是否已安装
3) 缺失依赖 -> 提示并停止
4) 下载并解包能力包
5) 执行 install entry
6) 执行 healthcheck
7) 写入安装记录与版本

## Install Record
- path: ~/.openclaw/capabilities/installed.json
- fields: id, version, installed_at, checksum, status

## Upgrade Rules
- 安装前执行 verify
- 失败可回滚至旧版本
