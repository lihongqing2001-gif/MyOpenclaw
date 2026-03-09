# Capability Package Spec (v0.1)

## Purpose
将 OpenClaw 能力模块化打包，支持新电脑一键安装与依赖解锁。

## Package Layout
- capability-manifest.json (machine)
- README.md (human)
- OPENCLAW.md (agent)
- install.sh / install.py (install entry)
- healthcheck.sh / healthcheck.py (health entry)
- assets/ (optional)
- skills/ (packaged skills)
- sops/ (module SOPs)

## capability-manifest.json
Required fields:
- id (naming: cap.<org>.<domain>.<name>)
- name
- version
- description
- dependencies (array of capability ids)
- skills (array of relative paths)
- sops (array of relative paths)
- install (entry command)
- healthcheck (entry command)
- outputs (paths produced)
- ownership (team/author)
- publish (clawhub | registry url)

## Notes
- 发布位置采用 ClawHub 或自建包索引服务
- 所有能力包必须可独立安装与健康检查
- 依赖缺失时安装器必须提示并阻断
