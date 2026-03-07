# Monitor-kit port open but backend not running

If `curl /api/health` returns empty reply while port 8000 is open:

1) Check status:

```
cd /Users/liumobei/.openclaw/workspace/agents/monitoring-self
./monitor-kit status
```

2) If `running=False` but `port_open=True`, restart:

```
./monitor-kit stop
./monitor-kit start
```

3) Re-verify:

```
curl -sS http://127.0.0.1:8000/api/health
```
