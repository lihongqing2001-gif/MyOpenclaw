from __future__ import annotations

import asyncio
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ingest_comm_log import DB_PATH, sync_all
from monitor import AgentMonitor

monitor = AgentMonitor(str(DB_PATH))
app = FastAPI(title="OpenClaw Agent Monitor API", version="0.6.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MainTaskCreate(BaseModel):
    title: str
    owner: str = "董事长"
    priority_weight: float = 1.0
    risk_weight: float = 1.0
    time_weight: float = 1.0


class MainTaskUpdate(BaseModel):
    status: str
    progress_percent: int


class IntakeRequest(BaseModel):
    demand: str
    owner: str = "董事长"
    seed_agent: str = "designer-v1"
    difficulty: str = "medium"


class SubTaskCreate(BaseModel):
    main_task_id: int
    agent_id: str
    task_desc: str
    difficulty: str = "medium"
    request_id: str | None = None
    risk_level: str = "L2"
    due_at: str | None = None


class ApprovalRequest(BaseModel):
    task_id: int
    decision: str
    note: str = ""


class DependencyRequest(BaseModel):
    task_id: int
    depends_on_task_id: int


def _rows(query: str, args: tuple = ()): 
    import sqlite3

    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute(query, args)
        return [dict(r) for r in cur.fetchall()]


def _write_guard(role: str | None):
    if (role or "").lower() not in {"chairman", "admin"}:
        raise HTTPException(status_code=403, detail="write operation requires role chairman/admin")


def _sync():
    return sync_all(monitor, db_path=DB_PATH)


def _demand_summary():
    rows = _rows(
        """
        SELECT id, progress_percent, priority_weight, risk_weight, time_weight
        FROM main_tasks
        """
    )
    if not rows:
        return {"total_main_tasks": 0, "done_main_tasks": 0, "satisfaction_percent": 0}

    done = len([r for r in rows if int(r["progress_percent"]) >= 100])
    weighted_sum = 0.0
    weighted_done = 0.0
    for r in rows:
        w = float(r.get("priority_weight") or 1.0) * float(r.get("risk_weight") or 1.0) * float(r.get("time_weight") or 1.0)
        weighted_sum += w
        weighted_done += w * (float(r.get("progress_percent") or 0.0) / 100.0)
    satisfaction = int(round((weighted_done / weighted_sum) * 100)) if weighted_sum else 0
    return {"total_main_tasks": len(rows), "done_main_tasks": done, "satisfaction_percent": satisfaction}


def _is_self_improvement_task(title: str) -> bool:
    t = (title or "").strip()
    keywords = ["自我提升", "构建并迭代 OpenClaw 自监控面板", "自动把董事长新需求建成主任务卡片"]
    return any(k in t for k in keywords)


def _snapshot():
    agents = _rows(
        """
        SELECT
            s.agent_id,
            s.activity,
            s.updated_at,
            t.id as task_id,
            t.request_id,
            t.task_desc,
            t.status,
            t.progress_percent,
            t.difficulty
        FROM agent_status s
        LEFT JOIN tasks t ON t.id = s.current_task_id
        WHERE s.agent_id LIKE '%-v1'
        ORDER BY s.agent_id ASC
        """
    )

    tasks = _rows(
        """
        SELECT
            t.id,
            t.request_id,
            t.main_task_id,
            t.agent_id,
            t.task_desc,
            t.difficulty,
            t.status,
            t.progress_percent,
            t.risk_level,
            t.requires_approval,
            t.approved,
            t.due_at,
            CASE
              WHEN t.due_at IS NOT NULL AND t.status != 'done' AND t.due_at < DATETIME('now') THEN 1
              ELSE 0
            END AS overdue,
            (
              SELECT COUNT(*)
              FROM task_dependencies d
              JOIN tasks dep ON dep.id = d.depends_on_task_id
              WHERE d.task_id = t.id AND dep.status != 'done'
            ) AS blocked_by,
            COALESCE(SUM(l.total_tokens), 0) AS total_tokens,
            t.updated_at
        FROM tasks t
        LEFT JOIN token_log l ON l.task_id = t.id
        WHERE t.status IN ('assigned', 'in_progress', 'blocked')
        GROUP BY t.id
        ORDER BY t.updated_at DESC
        """
    )

    main_tasks_all = _rows(
        """
        SELECT id, title, owner, status, progress_percent,
               priority_weight, risk_weight, time_weight, updated_at
        FROM main_tasks
        WHERE status IN ('assigned', 'in_progress', 'blocked')
        ORDER BY updated_at DESC
        """
    )
    self_improvement_tasks = [m for m in main_tasks_all if _is_self_improvement_task(m.get("title", ""))]
    main_tasks = [m for m in main_tasks_all if not _is_self_improvement_task(m.get("title", ""))]

    total = _rows("SELECT COALESCE(SUM(total_tokens), 0) AS total_tokens FROM token_log")[0]
    by_agent = _rows(
        """
        SELECT t.agent_id, COALESCE(SUM(l.total_tokens), 0) AS total_tokens
        FROM tasks t
        LEFT JOIN token_log l ON l.task_id = t.id
        GROUP BY t.agent_id
        ORDER BY total_tokens DESC
        """
    )

    timeline = _rows(
        """
        SELECT id, request_id, event_type, actor, message, created_at
        FROM events
        ORDER BY id DESC
        LIMIT 50
        """
    )

    self_improvement = {
        "healthy": bool(self_improvement_tasks),
        "count": len(self_improvement_tasks),
        "last_updated": self_improvement_tasks[0]["updated_at"] if self_improvement_tasks else None,
        "items": [
            {"id": m["id"], "title": m["title"], "status": m["status"], "updated_at": m["updated_at"]}
            for m in self_improvement_tasks[:5]
        ],
    }

    return {
        "agents": agents,
        "tasks": tasks,
        "main_tasks": main_tasks,
        "self_improvement": self_improvement,
        "demand": _demand_summary(),
        "tokens": {"global": total, "by_agent": by_agent},
        "timeline": timeline,
    }


@app.post("/api/sync")
def api_sync():
    return _sync()


@app.post("/api/intake")
def intake_demand(payload: IntakeRequest, x_role: str | None = Header(default=None)):
    _write_guard(x_role)
    mid = monitor.create_main_task(payload.demand, owner=payload.owner)
    rid = f"REQ-MAIN-{mid:04d}-001"
    tid = monitor.assign_task(
        payload.seed_agent,
        f"拆解主任务: {payload.demand}",
        payload.difficulty,
        request_id=rid,
        main_task_id=mid,
        risk_level="L2",
    )
    monitor.update_progress(tid, "assigned", 10, activity="waiting")
    return {"main_task_id": mid, "seed_task_id": tid, "request_id": rid}


@app.post("/api/main-tasks")
def create_main_task(payload: MainTaskCreate, x_role: str | None = Header(default=None)):
    _write_guard(x_role)
    mid = monitor.create_main_task(
        payload.title,
        owner=payload.owner,
        priority_weight=payload.priority_weight,
        risk_weight=payload.risk_weight,
        time_weight=payload.time_weight,
    )
    return {"main_task_id": mid}


@app.patch("/api/main-tasks/{main_task_id}")
def update_main_task(main_task_id: int, payload: MainTaskUpdate, x_role: str | None = Header(default=None)):
    _write_guard(x_role)
    monitor.update_main_task(main_task_id, payload.status, payload.progress_percent)
    return {"ok": True}


@app.post("/api/subtasks")
def create_subtask(payload: SubTaskCreate, x_role: str | None = Header(default=None)):
    _write_guard(x_role)
    tid = monitor.assign_task(
        payload.agent_id,
        payload.task_desc,
        payload.difficulty,
        request_id=payload.request_id,
        main_task_id=payload.main_task_id,
        risk_level=payload.risk_level,
        due_at=payload.due_at,
    )
    return {"task_id": tid}


@app.post("/api/approvals")
def approval(payload: ApprovalRequest, x_role: str | None = Header(default=None)):
    _write_guard(x_role)
    monitor.approve_task(payload.task_id, approver=(x_role or "admin"), decision=payload.decision, note=payload.note)
    return {"ok": True}


@app.post("/api/dependencies")
def dependency(payload: DependencyRequest, x_role: str | None = Header(default=None)):
    _write_guard(x_role)
    monitor.add_dependency(payload.task_id, payload.depends_on_task_id)
    return {"ok": True}


@app.get("/api/snapshot")
def api_snapshot():
    _sync()
    return _snapshot()


@app.get("/api/main-tasks")
def list_main_tasks():
    _sync()
    return _snapshot()["main_tasks"]


@app.get("/api/tasks/active")
def tasks_active():
    _sync()
    return _snapshot()["tasks"]


@app.get("/api/agents/status")
def agents_status():
    _sync()
    return _snapshot()["agents"]


@app.get("/api/stats/tokens")
def stats_tokens():
    _sync()
    return _snapshot()["tokens"]


@app.get("/api/demand/summary")
def demand_summary():
    _sync()
    return _snapshot()["demand"]


@app.get("/api/timeline")
def timeline():
    _sync()
    return _snapshot()["timeline"]


@app.get("/api/replay/{request_id}")
def replay(request_id: str):
    _sync()
    events = _rows(
        "SELECT id, request_id, event_type, actor, message, created_at FROM events WHERE request_id=? ORDER BY id ASC",
        (request_id,),
    )
    task = _rows(
        "SELECT id, request_id, main_task_id, agent_id, task_desc, status, progress_percent FROM tasks WHERE request_id=?",
        (request_id,),
    )
    return {"request_id": request_id, "task": task[0] if task else None, "events": events}


@app.get("/api/health")
def health():
    _sync()
    db_ok = Path(DB_PATH).exists()
    stale = _rows(
        """
        SELECT COUNT(*) AS c
        FROM agent_status
        WHERE updated_at < DATETIME('now', '-30 minutes')
        """
    )[0]["c"]
    return {
        "ok": bool(db_ok),
        "db": "ok" if db_ok else "missing",
        "stale_agents": int(stale or 0),
        "time": datetime.now().isoformat(timespec="seconds"),
    }


@app.post("/api/self-heal")
def self_heal(x_role: str | None = Header(default=None)):
    _write_guard(x_role)
    _sync()
    import sqlite3

    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.execute("DELETE FROM agent_status WHERE agent_id NOT LIKE '%-v1'")
        conn.commit()
    monitor.log_event("self_heal", "system", "removed non-entity noise rows")
    return {"ok": True, "action": "noise rows removed + sync"}


@app.get("/api/reports/weekly")
def weekly_report():
    _sync()
    return _report(period="weekly")


@app.get("/api/reports/monthly")
def monthly_report():
    _sync()
    return _report(period="monthly")


def _report(period: str):
    if period == "weekly":
        window = "-7 day"
    else:
        window = "-30 day"

    done = _rows("SELECT COUNT(*) AS c FROM tasks WHERE status='done' AND updated_at >= DATETIME('now', ?)", (window,))[0]["c"]
    blocked = _rows("SELECT COUNT(*) AS c FROM tasks WHERE status='blocked' AND updated_at >= DATETIME('now', ?)", (window,))[0]["c"]
    overdue = _rows(
        "SELECT COUNT(*) AS c FROM tasks WHERE due_at IS NOT NULL AND due_at < DATETIME('now') AND status != 'done'"
    )[0]["c"]
    tokens = _rows("SELECT COALESCE(SUM(total_tokens),0) AS c FROM token_log WHERE created_at >= DATETIME('now', ?)", (window,))[0]["c"]
    return {
        "period": period,
        "done_tasks": int(done or 0),
        "blocked_tasks": int(blocked or 0),
        "overdue_tasks": int(overdue or 0),
        "tokens": int(tokens or 0),
        "demand": _demand_summary(),
    }


@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            _sync()
            await websocket.send_json(_snapshot())
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        return
