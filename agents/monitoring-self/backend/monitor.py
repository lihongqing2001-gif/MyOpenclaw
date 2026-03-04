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
        conn = sqlite3.connect(self.db_path, timeout=5)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=5000")
        return conn

    def _now(self) -> str:
        return datetime.now().isoformat(timespec="seconds")

    def _ensure_column(self, conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
        cols = [r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]
        if column not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")

    def _init_db(self) -> None:
        with self._conn() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS main_tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    owner TEXT,
                    status TEXT NOT NULL DEFAULT 'in_progress',
                    progress_percent INTEGER NOT NULL DEFAULT 0,
                    priority_weight REAL NOT NULL DEFAULT 1.0,
                    risk_weight REAL NOT NULL DEFAULT 1.0,
                    time_weight REAL NOT NULL DEFAULT 1.0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_id TEXT UNIQUE,
                    main_task_id INTEGER,
                    agent_id TEXT NOT NULL,
                    task_desc TEXT NOT NULL,
                    difficulty TEXT NOT NULL,
                    status TEXT NOT NULL,
                    progress_percent INTEGER NOT NULL DEFAULT 0,
                    risk_level TEXT NOT NULL DEFAULT 'L2',
                    requires_approval INTEGER NOT NULL DEFAULT 0,
                    approved INTEGER NOT NULL DEFAULT 1,
                    due_at TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(main_task_id) REFERENCES main_tasks(id)
                );

                CREATE TABLE IF NOT EXISTS task_dependencies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id INTEGER NOT NULL,
                    depends_on_task_id INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    UNIQUE(task_id, depends_on_task_id)
                );

                CREATE TABLE IF NOT EXISTS approvals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id INTEGER NOT NULL,
                    approver TEXT,
                    decision TEXT NOT NULL,
                    note TEXT,
                    created_at TEXT NOT NULL
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

                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_id TEXT,
                    event_type TEXT NOT NULL,
                    actor TEXT,
                    message TEXT,
                    created_at TEXT NOT NULL
                );
                """
            )
            self._ensure_column(conn, "main_tasks", "priority_weight", "priority_weight REAL NOT NULL DEFAULT 1.0")
            self._ensure_column(conn, "main_tasks", "risk_weight", "risk_weight REAL NOT NULL DEFAULT 1.0")
            self._ensure_column(conn, "main_tasks", "time_weight", "time_weight REAL NOT NULL DEFAULT 1.0")
            self._ensure_column(conn, "tasks", "main_task_id", "main_task_id INTEGER")
            self._ensure_column(conn, "tasks", "risk_level", "risk_level TEXT NOT NULL DEFAULT 'L2'")
            self._ensure_column(conn, "tasks", "requires_approval", "requires_approval INTEGER NOT NULL DEFAULT 0")
            self._ensure_column(conn, "tasks", "approved", "approved INTEGER NOT NULL DEFAULT 1")
            self._ensure_column(conn, "tasks", "due_at", "due_at TEXT")

    def log_event(self, event_type: str, actor: str, message: str, request_id: Optional[str] = None) -> None:
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO events (request_id, event_type, actor, message, created_at) VALUES (?, ?, ?, ?, ?)",
                (request_id, event_type, actor, message, self._now()),
            )

    def create_main_task(
        self,
        title: str,
        owner: str = "董事长",
        status: str = "in_progress",
        priority_weight: float = 1.0,
        risk_weight: float = 1.0,
        time_weight: float = 1.0,
    ) -> int:
        ts = self._now()
        with self._conn() as conn:
            cur = conn.execute(
                """
                INSERT INTO main_tasks (
                    title, owner, status, progress_percent,
                    priority_weight, risk_weight, time_weight,
                    created_at, updated_at
                )
                VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)
                """,
                (title, owner, status, priority_weight, risk_weight, time_weight, ts, ts),
            )
            main_id = int(cur.lastrowid)
        self.log_event("main_task_created", owner, f"created main task: {title}", request_id=f"MAIN-{main_id}")
        return main_id

    def update_main_task(self, main_task_id: int, status: str, progress_percent: int) -> None:
        ts = self._now()
        with self._conn() as conn:
            conn.execute(
                "UPDATE main_tasks SET status=?, progress_percent=?, updated_at=? WHERE id=?",
                (status, progress_percent, ts, main_task_id),
            )
        self.log_event("main_task_updated", "system", f"main_task={main_task_id} status={status} progress={progress_percent}")

    def assign_task(
        self,
        agent_id: str,
        task_desc: str,
        difficulty: str,
        request_id: Optional[str] = None,
        main_task_id: Optional[int] = None,
        risk_level: str = "L2",
        due_at: Optional[str] = None,
    ) -> int:
        ts = self._now()
        rid = request_id or f"REQ-{int(datetime.now().timestamp())}"
        requires_approval = 1 if risk_level.upper() == "L3" else 0
        approved = 0 if requires_approval else 1
        with self._conn() as conn:
            cur = conn.execute(
                """
                INSERT INTO tasks (
                    request_id, main_task_id, agent_id, task_desc, difficulty,
                    status, progress_percent, risk_level, requires_approval, approved, due_at,
                    created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, 'assigned', 0, ?, ?, ?, ?, ?, ?)
                """,
                (
                    rid,
                    main_task_id,
                    agent_id,
                    task_desc,
                    difficulty,
                    risk_level.upper(),
                    requires_approval,
                    approved,
                    due_at,
                    ts,
                    ts,
                ),
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
        self.log_event("task_assigned", agent_id, f"assigned: {task_desc}", request_id=rid)
        if requires_approval:
            self.log_event("approval_required", "admin", f"task={task_id} requires L3 approval", request_id=rid)
        return task_id

    def approve_task(self, task_id: int, approver: str, decision: str, note: str = "") -> None:
        ts = self._now()
        decision_u = decision.lower()
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO approvals (task_id, approver, decision, note, created_at) VALUES (?, ?, ?, ?, ?)",
                (task_id, approver, decision_u, note, ts),
            )
            approved = 1 if decision_u == "approved" else 0
            status = "assigned" if approved else "blocked"
            conn.execute("UPDATE tasks SET approved=?, status=?, updated_at=? WHERE id=?", (approved, status, ts, task_id))
            row = conn.execute("SELECT request_id FROM tasks WHERE id=?", (task_id,)).fetchone()
        rid = row["request_id"] if row else None
        self.log_event("approval_decision", approver, f"task={task_id} decision={decision_u}", request_id=rid)

    def add_dependency(self, task_id: int, depends_on_task_id: int) -> None:
        with self._conn() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id, created_at) VALUES (?, ?, ?)",
                (task_id, depends_on_task_id, self._now()),
            )
        self.log_event("dependency_added", "system", f"task={task_id} depends_on={depends_on_task_id}")

    def update_progress(
        self,
        task_id: int,
        status: str,
        progress_percent: int,
        activity: Optional[str] = None,
    ) -> None:
        ts = self._now()
        event_agent = "system"
        event_rid = None
        with self._conn() as conn:
            row_task = conn.execute("SELECT approved, request_id FROM tasks WHERE id=?", (task_id,)).fetchone()
            if row_task and int(row_task["approved"]) == 0 and status in ("in_progress", "done"):
                raise ValueError("task requires approval before execution")

            conn.execute("UPDATE tasks SET status=?, progress_percent=?, updated_at=? WHERE id=?", (status, progress_percent, ts, task_id))
            row = conn.execute("SELECT agent_id, main_task_id, request_id FROM tasks WHERE id=?", (task_id,)).fetchone()
            if row:
                event_agent = row["agent_id"]
                event_rid = row["request_id"]
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

                if row["main_task_id"]:
                    agg = conn.execute(
                        """
                        SELECT ROUND(COALESCE(AVG(progress_percent), 0), 0) AS avg_progress,
                               SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) AS done_count,
                               COUNT(*) AS total_count
                        FROM tasks
                        WHERE main_task_id=?
                        """,
                        (row["main_task_id"],),
                    ).fetchone()
                    avg_progress = int(agg["avg_progress"] or 0)
                    done_count = int(agg["done_count"] or 0)
                    total_count = int(agg["total_count"] or 0)
                    main_status = "done" if total_count > 0 and done_count == total_count else "in_progress"
                    conn.execute(
                        "UPDATE main_tasks SET status=?, progress_percent=?, updated_at=? WHERE id=?",
                        (main_status, avg_progress, ts, row["main_task_id"]),
                    )

        self.log_event("task_progress", event_agent, f"task={task_id} status={status} progress={progress_percent}", request_id=event_rid)

    def log_token_usage(self, task_id: int, prompt_tokens: int, completion_tokens: int) -> None:
        ts = self._now()
        total = int(prompt_tokens) + int(completion_tokens)
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO token_log (task_id, prompt_tokens, completion_tokens, total_tokens, created_at) VALUES (?, ?, ?, ?, ?)",
                (task_id, int(prompt_tokens), int(completion_tokens), total, ts),
            )
            row = conn.execute("SELECT request_id FROM tasks WHERE id=?", (task_id,)).fetchone()
        self.log_event("token_usage", "system", f"task={task_id} total_tokens={total}", request_id=(row["request_id"] if row else None))
