window.DASHBOARD_DATA = {
  "metrics": {
    "total_agents": 9,
    "total_handoffs": 3,
    "ready_agents": 9,
    "blocked_agents": 0,
    "updated_at": "2026-03-04T21:50:12"
  },
  "agents": [
    {
      "agent_id": "design-architect-v1",
      "name": "设计师",
      "role": "architect",
      "risk_level": "L2",
      "registry_status": "READY",
      "runtime_status": "READY",
      "current_request": null,
      "updated_at": "2026-03-04T21:03:00+08:00"
    },
    {
      "agent_id": "admin-v1",
      "name": "管理员",
      "role": "admin",
      "risk_level": "L3",
      "registry_status": "READY",
      "runtime_status": "READY",
      "current_request": null,
      "updated_at": "2026-03-04T21:05:00+08:00"
    },
    {
      "agent_id": "engineer-v1",
      "name": "工程师",
      "role": "engineer",
      "risk_level": "L2",
      "registry_status": "READY",
      "runtime_status": "READY",
      "current_request": null,
      "updated_at": "2026-03-04T21:05:00+08:00"
    },
    {
      "agent_id": "executor-v1",
      "name": "Executor",
      "role": "executor",
      "risk_level": "L2",
      "registry_status": "READY",
      "runtime_status": "READY",
      "current_request": null,
      "updated_at": "2026-03-04T21:05:00+08:00"
    },
    {
      "agent_id": "life-assistant-v1",
      "name": "生活助理",
      "role": "life-assistant",
      "risk_level": "L2",
      "registry_status": "READY",
      "runtime_status": "READY",
      "current_request": null,
      "updated_at": "2026-03-04T21:05:00+08:00"
    },
    {
      "agent_id": "product-manager-v1",
      "name": "产品经理",
      "role": "planner",
      "risk_level": "L2",
      "registry_status": "READY",
      "runtime_status": "READY",
      "current_request": null,
      "updated_at": "2026-03-04T21:03:00+08:00"
    },
    {
      "agent_id": "operations-manager-v1",
      "name": "运营官",
      "role": "operator",
      "risk_level": "L2",
      "registry_status": "READY",
      "runtime_status": "READY",
      "current_request": null,
      "updated_at": "2026-03-04T21:03:00+08:00"
    },
    {
      "agent_id": "growth-strategist-v1",
      "name": "增长官",
      "role": "growth",
      "risk_level": "L2",
      "registry_status": "READY",
      "runtime_status": "READY",
      "current_request": null,
      "updated_at": "2026-03-04T21:03:00+08:00"
    },
    {
      "agent_id": "qa-auditor-v1",
      "name": "审计官",
      "role": "auditor",
      "risk_level": "L2",
      "registry_status": "READY",
      "runtime_status": "READY",
      "current_request": null,
      "updated_at": "2026-03-04T21:03:00+08:00"
    }
  ],
  "handoffs": [
    {
      "request_id": "REQ-20260304-0001",
      "from_agent": "中枢",
      "to_agent": "design-architect-v1",
      "intent": "design implementation plan for agent routing",
      "status": "DONE",
      "output_ref": "agents/workspaces/designer/OUTBOX.md#REQ-20260304-0001"
    },
    {
      "request_id": "REQ-20260304-0001-H2",
      "from_agent": "design-architect-v1",
      "to_agent": "engineer-v1",
      "intent": "implement routing files and alias map checks",
      "status": "DONE",
      "output_ref": "agents/workspaces/engineer/OUTBOX.md#REQ-20260304-0001-H2"
    },
    {
      "request_id": "REQ-20260304-0001-H3",
      "from_agent": "engineer-v1",
      "to_agent": "qa-auditor-v1",
      "intent": "verify structure and policy compliance",
      "status": "DONE",
      "output_ref": "agents/workspaces/qa-auditor/OUTBOX.md#REQ-20260304-0001-H3"
    }
  ]
};
