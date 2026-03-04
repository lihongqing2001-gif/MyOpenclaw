from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ingest_comm_log import DB_PATH, sync_all
from monitor import AgentMonitor

BASE_DIR = Path(__file__).resolve().parent

monitor = AgentMonitor(str(DB_PATH))
app = FastAPI(title="OpenClaw Agent Monitor API", version="0.4.0")

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


class MainTaskUpdate(BaseModel):
    status: str
    progress_percent: int


def _rows(query: str, args: tuple = ()): 
    import sqlite3

    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute(query, args)
        return [dict(r) for r in cur.fetchall()]


def _sync():
    return sync_all(monitor, db_path=DB_PATH)


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
            COALESCE(SUM(l.total_tokens), 0) AS total_tokens,
            t.updated_at
        FROM tasks t
        LEFT JOIN token_log l ON l.task_id = t.id
        WHERE t.status IN ('assigned', 'in_progress', 'blocked')
        GROUP BY t.id
        ORDER BY t.updated_at DESC
        """
    )
    main_tasks = _rows(
        """
        SELECT id, title, owner, status, progress_percent, updated_at
        FROM main_tasks
        WHERE status IN ('assigned', 'in_progress', 'blocked')
        ORDER BY updated_at DESC
        """
    )
    summary = _rows(
        """
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) AS done
        FROM main_tasks
        """
    )[0]
    total_main = int(summary.get("total") or 0)
    done_main = int(summary.get("done") or 0)
    satisfaction = int(round((done_main / total_main) * 100)) if total_main else 0

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
    return {
        "agents": agents,
        "tasks": tasks,
        "main_tasks": main_tasks,
        "demand": {
            "total_main_tasks": total_main,
            "done_main_tasks": done_main,
            "satisfaction_percent": satisfaction,
        },
        "tokens": {"global": total, "by_agent": by_agent},
    }


@app.post("/api/sync")
def api_sync():
    return _sync()


@app.post("/api/main-tasks")
def create_main_task(payload: MainTaskCreate):
    mid = monitor.create_main_task(payload.title, owner=payload.owner)
    return {"main_task_id": mid}


@app.patch("/api/main-tasks/{main_task_id}")
def update_main_task(main_task_id: int, payload: MainTaskUpdate):
    monitor.update_main_task(main_task_id, payload.status, payload.progress_percent)
    return {"ok": True}


@app.get("/api/main-tasks")
def list_main_tasks():
    _sync()
    return _snapshot()["main_tasks"]


@app.get("/api/demand/summary")
def demand_summary():
    _sync()
    return _snapshot()["demand"]


@app.get("/api/agents/status")
def agents_status():
    _sync()
    return _snapshot()["agents"]


@app.get("/api/tasks/active")
def tasks_active():
    _sync()
    return _snapshot()["tasks"]


@app.get("/api/stats/tokens")
def stats_tokens():
    _sync()
    return _snapshot()["tokens"]


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


@app.post("/api/mock/seed")
def mock_seed():
    t1 = monitor.assign_task("designer", "Design monitoring dashboard architecture", "medium", "REQ-MON-001")
    monitor.update_progress(t1, "in_progress", 35, "thinking")
    monitor.log_token_usage(t1, 420, 180)

    t2 = monitor.assign_task("engineer", "Implement FastAPI monitor API", "complex", "REQ-MON-002")
    monitor.update_progress(t2, "in_progress", 62, "executing")
    monitor.log_token_usage(t2, 680, 240)

    t3 = monitor.assign_task("admin", "Review governance and risk rules", "simple", "REQ-MON-003")
    monitor.update_progress(t3, "blocked", 20, "waiting")
    monitor.log_token_usage(t3, 160, 70)

    return {"seeded": True}
