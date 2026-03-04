# 03 运维与排障

## 服务管理

```bash
./monitor-kit start
./monitor-kit status
./monitor-kit stop
```

## 导出/导入配置

```bash
./monitor-kit export ./toolkit/exports
./monitor-kit import ./toolkit/exports
```

## 分发桥接（同步到看板）

```bash
./monitor-kit dispatch \
  --main-title "主任务：示例" \
  --agent-id engineer-v1 \
  --task-desc "示例子任务" \
  --request-id REQ-DEMO-001 \
  --run-id demo-run-001

./monitor-kit complete --request-id REQ-DEMO-001
```

## 常见问题

- 端口占用
  - `lsof -i :8000`
  - 修改 `toolkit/config.json` 中的 `port`，然后重启
- venv 缺失
  - 重新执行 `./install.sh`
- 数据库锁
  - `./monitor-kit stop`
  - 确认无旧进程后再 `./monitor-kit start`

## 日志位置

- 服务日志: `agents/monitoring-self/data/monitor-kit.log`
- 验收报告: `agents/reviews/agenttoagent-acceptance-20260304.md`
