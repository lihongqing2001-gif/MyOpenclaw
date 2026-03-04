from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from monitor import AgentMonitor

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR.parent / "data" / "monitor.db"

monitor = AgentMonitor(str(DB_PATH))
app = FastAPI(title="OpenClaw Agent Monitor API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _rows(query: str, args: tuple = ()):
    import sqlite3

    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute(query, args)
        return [dict(r) for r in cur.fetchall()]


@app.get("/api/agents/status")
def agents_status():
    return _rows(
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


@app.get("/api/tasks/active")
def tasks_active():
    return _rows(
        """
        SELECT
            t.id,
            t.request_id,
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


@app.get("/api/stats/tokens")
def stats_tokens():
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
    return {"global": total, "by_agent": by_agent}


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
