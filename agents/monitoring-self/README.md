# OpenClaw Self-Monitoring Panel

## 教程目录

- `tutorials/01-quick-start.md`
- `tutorials/02-migrate-to-new-openclaw.md`
- `tutorials/03-operations-and-troubleshooting.md`

## MVP toolkit (one-click)

```bash
cd /Users/liumobei/.openclaw/workspace/agents/monitoring-self
./install.sh
```

Common commands:

```bash
./monitor-kit doctor
./monitor-kit doctor --fix
./monitor-kit setup
./monitor-kit export ./toolkit/exports
./monitor-kit import ./toolkit/exports
./monitor-kit start
./monitor-kit status
./monitor-kit stop
```

## Day-2 commands

Auto-fix safe environment issues (missing config/data/db):

```bash
./monitor-kit doctor --fix
```

Export and import toolkit config + patch:

```bash
./monitor-kit export ./toolkit/exports
./monitor-kit import ./toolkit/exports
```

## 迁移到新的 OpenClaw 实例

1) 在新实例中拷贝 `agents/monitoring-self` 目录并执行安装：

```bash
cd <NEW_WORKSPACE>/agents/monitoring-self
./install.sh
```

2) 生成或导入配置：

```bash
./monitor-kit setup
# 或
./monitor-kit import ./toolkit/exports
```

3) 运行体检并按提示补齐缺失项：

```bash
./monitor-kit doctor --fix
./monitor-kit doctor
```

4) 应用 OpenClaw 配置补丁（手工合并到 openclaw.json）：

- 自动生成: `toolkit/openclaw.patch.json`
- 模板参考: `toolkit/openclaw.patch.template.json`

5) 启动并验证：

```bash
./monitor-kit start
curl http://127.0.0.1:8000/api/health
```

## 常见问题排查

- 端口占用: `lsof -i :8000`，改 `toolkit/config.json` 的 `port` 后重启。
- venv 缺失: 重新执行 `./install.sh`。
- 数据库锁: 先 `./monitor-kit stop`，确认无旧进程后再 `./monitor-kit start`。

## Manual backend run (optional)
cd /Users/liumobei/.openclaw/workspace/agents/monitoring-self/backend
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn
uvicorn app:app --reload --host 127.0.0.1 --port 8000

## Open frontend
open /Users/liumobei/.openclaw/workspace/agents/monitoring-self/frontend/index.html

## Role-based write guard
Write APIs require header:

- `X-Role: chairman` or `X-Role: admin`

## Core APIs added
- SLA/Overdue: `GET /api/tasks/active` (fields: `due_at`, `overdue`)
- L3 approval flow: `POST /api/approvals`
- Dependencies (DAG edge): `POST /api/dependencies`
- Weighted satisfaction: `GET /api/demand/summary`
- Timeline: `GET /api/timeline`
- Reports: `GET /api/reports/weekly`, `GET /api/reports/monthly`
- Health: `GET /api/health`
- Self-heal: `POST /api/self-heal`
- Replay chain: `GET /api/replay/{request_id}`
- Demand intake: `POST /api/intake`

## Examples
Create demand -> auto main task card + seed subtask:

```bash
curl -X POST http://127.0.0.1:8000/api/intake \
  -H 'X-Role: chairman' \
  -H 'Content-Type: application/json' \
  -d '{"demand":"为监控面板加审批流","owner":"董事长"}'
```

Create L3 subtask:

```bash
curl -X POST http://127.0.0.1:8000/api/subtasks \
  -H 'X-Role: chairman' \
  -H 'Content-Type: application/json' \
  -d '{
    "main_task_id":1,
    "agent_id":"executor-v1",
    "task_desc":"执行生产级变更",
    "difficulty":"complex",
    "risk_level":"L3",
    "due_at":"2026-03-05T12:00:00"
  }'
```

Approve L3 subtask:

```bash
curl -X POST http://127.0.0.1:8000/api/approvals \
  -H 'X-Role: admin' \
  -H 'Content-Type: application/json' \
  -d '{"task_id": 9, "decision":"approved", "note":"go"}'
```

Add dependency:

```bash
curl -X POST http://127.0.0.1:8000/api/dependencies \
  -H 'X-Role: chairman' \
  -H 'Content-Type: application/json' \
  -d '{"task_id": 10, "depends_on_task_id": 9}'
```

Run self-heal:

```bash
curl -X POST http://127.0.0.1:8000/api/self-heal -H 'X-Role: admin'
```
