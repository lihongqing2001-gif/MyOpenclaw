window.DASHBOARD_DATA = {
  "metrics": {
    "total_agents": 9,
    "total_handoffs": 5,
    "ready_agents": 9,
    "blocked_agents": 0,
    "swarm_tasks": 3,
    "swarm_review": 0,
    "swarm_verified": 1,
    "swarm_blocked": 0,
    "updated_at": "2026-03-17T21:17:43"
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
      "name": "秘书",
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
    },
    {
      "request_id": "REQ-SOP-20260305-001",
      "from_agent": "中枢",
      "to_agent": "admin-v1",
      "intent": "落地并执行会话控制SOP（分发、验收、回填、恢复）",
      "status": "DONE",
      "run_id": "manual-sop-rollout"
    },
    {
      "request_id": "REQ-SOP-20260305-001-R1",
      "from_agent": "中枢",
      "to_agent": "admin-v1",
      "intent": "落地并执行会话控制SOP（分发、验收、回填、恢复）",
      "status": "DONE",
      "run_id": "manual-sop-rollout-r1"
    }
  ],
  "swarm": {
    "updated_at": "2026-03-17T13:17:24.468153+00:00",
    "tasks": [
      {
        "request_id": "swarm-20260317-001",
        "title": "Bootstrap swarm v1 registry",
        "repo": "/Users/liumobei/.openclaw/workspace",
        "agent": "codex",
        "owner_agent": "main",
        "agent_model": null,
        "session_key": null,
        "worktree_path": null,
        "branch": null,
        "status": "NEW",
        "priority": "high",
        "risk_level": "L2",
        "acceptance": [
          "registry persists",
          "monitor refreshes checks"
        ],
        "expected_output": "bootstrap validation output",
        "rollback_note": "remove bootstrap task after schema stabilization",
        "notify_on_complete": false,
        "summary": null,
        "blocked_reason": null,
        "review_evidence": {
          "pr_url": null,
          "screenshot_urls": [],
          "review_notes": []
        },
        "checks": {
          "session_alive": false,
          "worktree_exists": false,
          "branch_exists": false,
          "branch_pushed": false,
          "pr_created": false,
          "ci_passed": false,
          "verified": false
        },
        "retry_count": 0,
        "created_at": "2026-03-17T12:13:16.067634+00:00",
        "updated_at": "2026-03-17T13:17:19.691654+00:00",
        "notes": [
          "bootstrap validation task"
        ],
        "status_changed_at": "2026-03-17T12:23:29.721139+00:00",
        "stale": {
          "is_stale": false,
          "reason": null,
          "age_seconds": 3229,
          "threshold_seconds": 14400,
          "basis": "status_changed_at",
          "since": null
        }
      },
      {
        "request_id": "swarm-20260317-002",
        "title": "Dispatch smoke test",
        "repo": "/Users/liumobei/.openclaw/workspace",
        "agent": "codex",
        "owner_agent": "main",
        "agent_model": null,
        "session_key": null,
        "worktree_path": "/Users/liumobei/.openclaw/workspace/agents/swarm/worktrees/swarm-20260317-002",
        "branch": "feat/swarm-smoke-test",
        "status": "VERIFIED",
        "priority": "medium",
        "risk_level": "L2",
        "acceptance": [
          "worktree created",
          "task dispatched"
        ],
        "expected_output": "smoke task registered with worktree",
        "rollback_note": "remove smoke worktree after validation",
        "notify_on_complete": false,
        "summary": "Verified smoke task with explicit evidence path.",
        "blocked_reason": null,
        "review_evidence": {
          "pr_url": null,
          "screenshot_urls": [],
          "review_notes": [
            "Dispatch path validated.",
            "reviewed registry and monitor outputs"
          ]
        },
        "checks": {
          "session_alive": false,
          "worktree_exists": true,
          "branch_exists": true,
          "branch_pushed": false,
          "pr_created": false,
          "ci_passed": false,
          "verified": true
        },
        "retry_count": 0,
        "created_at": "2026-03-17T12:22:22.083680+00:00",
        "updated_at": "2026-03-17T13:17:19.691990+00:00",
        "notes": [
          "dispatch validation",
          "Preparing worktree (new branch 'feat/swarm-smoke-test')\nHEAD is now at 9085664 feat: story-2 - Publish flow template",
          "worktree prepared: /Users/liumobei/.openclaw/workspace/agents/swarm/worktrees/swarm-20260317-002"
        ],
        "status_changed_at": "2026-03-17T13:17:19.643841+00:00",
        "stale": {
          "is_stale": false,
          "reason": null,
          "age_seconds": 0,
          "threshold_seconds": null,
          "basis": "status_changed_at",
          "since": null
        }
      },
      {
        "request_id": "swarm-20260317-003",
        "title": "Collect smoke test",
        "repo": "/Users/liumobei/.openclaw/workspace",
        "agent": "codex",
        "owner_agent": "main",
        "agent_model": null,
        "session_key": null,
        "session_pid": null,
        "session_log": null,
        "worktree_path": "/Users/liumobei/.openclaw/workspace/agents/swarm/worktrees/swarm-20260317-003",
        "branch": "feat/swarm-collect-test",
        "status": "DISPATCHED",
        "priority": "low",
        "risk_level": "L1",
        "acceptance": [
          "collect works"
        ],
        "expected_output": "verified summary",
        "rollback_note": "remove collect smoke task",
        "notify_on_complete": false,
        "summary": null,
        "blocked_reason": null,
        "review_evidence": {
          "pr_url": null,
          "screenshot_urls": [],
          "review_notes": []
        },
        "checks": {
          "session_alive": false,
          "worktree_exists": true,
          "branch_exists": true,
          "branch_pushed": false,
          "pr_created": false,
          "ci_passed": false,
          "verified": false
        },
        "retry_count": 1,
        "created_at": "2026-03-17T12:26:07.658989+00:00",
        "updated_at": "2026-03-17T13:17:22.109638+00:00",
        "notes": [
          "collect validation",
          "Preparing worktree (new branch 'feat/swarm-collect-test')\nHEAD is now at 9085664 feat: story-2 - Publish flow template",
          "worktree prepared: /Users/liumobei/.openclaw/workspace/agents/swarm/worktrees/swarm-20260317-003",
          "retry#1: re-steer smoke test",
          "retry validation"
        ],
        "status_changed_at": "2026-03-17T13:17:19.605234+00:00",
        "stale": {
          "is_stale": false,
          "reason": null,
          "age_seconds": 2,
          "threshold_seconds": 1800,
          "basis": "status_changed_at",
          "since": null
        }
      }
    ]
  }
};
