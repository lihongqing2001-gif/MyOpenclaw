from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional


class AgentMonitor:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _now(self) -> str:
        return datetime.now().isoformat(timespec="seconds")

    def _init_db(self) -> None:
        with self._conn() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_id TEXT UNIQUE,
                    agent_id TEXT NOT NULL,
                    task_desc TEXT NOT NULL,
                    difficulty TEXT NOT NULL,
                    status TEXT NOT NULL,
                    progress_percent INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS agent_status (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    agent_id TEXT UNIQUE NOT NULL,
                    activity TEXT NOT NULL,
                    current_task_id INTEGER,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(current_task_id) REFERENCES tasks(id)
                );

                CREATE TABLE IF NOT EXISTS token_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id INTEGER NOT NULL,
                    prompt_tokens INTEGER NOT NULL,
                    completion_tokens INTEGER NOT NULL,
                    total_tokens INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(task_id) REFERENCES tasks(id)
                );
                """
            )

    def assign_task(
        self,
        agent_id: str,
        task_desc: str,
        difficulty: str,
        request_id: Optional[str] = None,
    ) -> int:
        ts = self._now()
        rid = request_id or f"REQ-{int(datetime.now().timestamp())}"
        with self._conn() as conn:
            cur = conn.execute(
                """
                INSERT INTO tasks (request_id, agent_id, task_desc, difficulty, status, progress_percent, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'assigned', 0, ?, ?)
                """,
                (rid, agent_id, task_desc, difficulty, ts, ts),
            )
            task_id = int(cur.lastrowid)
            conn.execute(
                """
                INSERT INTO agent_status (agent_id, activity, current_task_id, updated_at)
                VALUES (?, 'waiting', ?, ?)
                ON CONFLICT(agent_id) DO UPDATE SET
                    activity=excluded.activity,
                    current_task_id=excluded.current_task_id,
                    updated_at=excluded.updated_at
                """,
                (agent_id, task_id, ts),
            )
            return task_id

    def update_progress(
        self,
        task_id: int,
        status: str,
        progress_percent: int,
        activity: Optional[str] = None,
    ) -> None:
        ts = self._now()
        with self._conn() as conn:
            conn.execute(
                """
                UPDATE tasks
                SET status=?, progress_percent=?, updated_at=?
                WHERE id=?
                """,
                (status, progress_percent, ts, task_id),
            )
            row = conn.execute("SELECT agent_id FROM tasks WHERE id=?", (task_id,)).fetchone()
            if row:
                conn.execute(
                    """
                    INSERT INTO agent_status (agent_id, activity, current_task_id, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(agent_id) DO UPDATE SET
                        activity=excluded.activity,
                        current_task_id=excluded.current_task_id,
                        updated_at=excluded.updated_at
                    """,
                    (row["agent_id"], activity or "executing", task_id, ts),
                )

    def log_token_usage(self, task_id: int, prompt_tokens: int, completion_tokens: int) -> None:
        ts = self._now()
        total = int(prompt_tokens) + int(completion_tokens)
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO token_log (task_id, prompt_tokens, completion_tokens, total_tokens, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (task_id, int(prompt_tokens), int(completion_tokens), total, ts),
            )
