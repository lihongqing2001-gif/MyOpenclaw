# Agent Dashboard

## Build data
python3 /Users/liumobei/.openclaw/workspace/agents/dashboard/build_dashboard_data.py

## Open panel
open /Users/liumobei/.openclaw/workspace/agents/dashboard/index.html

## Notes
- Rebuild data before refresh if registry/state/log changed.
- Data source files:
  - agents/registry/registry.yaml
  - agents/workspaces/*/STATE.json
  - agents/runs/COMM_LOG.md
