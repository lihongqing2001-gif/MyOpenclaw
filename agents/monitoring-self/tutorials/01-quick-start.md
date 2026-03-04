# 01 Quick Start

## 一键安装

```bash
cd /Users/liumobei/.openclaw/workspace/agents/monitoring-self
./install.sh
```

## 常用命令

```bash
./monitor-kit doctor
./monitor-kit doctor --fix
./monitor-kit setup
./monitor-kit start
./monitor-kit status
./monitor-kit stop
```

## 打开面板

```bash
open /Users/liumobei/.openclaw/workspace/agents/monitoring-self/frontend/index.html
```

## 基础健康检查

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/demand/summary
curl http://127.0.0.1:8000/api/reports/weekly
```
