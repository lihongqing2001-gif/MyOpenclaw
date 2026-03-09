# Capability Package Spec (v0.2)

## Purpose
将 OpenClaw 能力模块化打包，支持新电脑一键安装、依赖解锁与可追溯更新。

## Package Layout
- capability-manifest.json (machine)
- README.md (human)
- OPENCLAW.md (agent)
- install.sh / install.py (install entry)
- healthcheck.sh / healthcheck.py (health entry)
- assets/ (optional)
- skills/ (packaged skills)
- sops/ (module SOPs)
- outputs/ (optional, produced artifacts)

## capability-manifest.json (v0.2)
Required fields:
- id (naming: cap.<org>.<domain>.<name>)
- name
- version (semver)
- description
- domain
- category
- tags
- ownership (team/author)
- publish (clawhub | registry url)
- dependencies (array of capability ids)
- requires (openclaw version range)
- skills (array of relative paths)
- sops (array of relative paths)
- install (entry command)
- healthcheck (entry command)
- outputs (paths produced)

Optional fields:
- license
- changelog
- assets
- entrypoints (for CLI shortcuts)

## Registry Index (for ClawHub or self-hosted)
Each capability entry must expose:
- id, name, version, description
- checksum (package integrity)
- download_url
- requires
- dependencies
- size

## Notes
- 发布位置采用 ClawHub 或自建包索引服务
- 所有能力包必须可独立安装与健康检查
- 依赖缺失时安装器必须提示并阻断
- 版本升级需保留旧版本可回滚
