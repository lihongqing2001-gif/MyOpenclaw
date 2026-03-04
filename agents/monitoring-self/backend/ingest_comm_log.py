#!/usr/bin/env python3
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from monitor import AgentMonitor

ROOT = Path('/Users/liumobei/.openclaw/workspace')
COMM_LOG = ROOT / 'agents/runs/COMM_LOG.md'
WORKSPACES = ROOT / 'agents/workspaces'
DB_PATH = ROOT / 'agents/monitoring-self/data/monitor.db'


def parse_blocks(text: str):
    blocks = []
    cur = None
    for line in text.splitlines():
        s = line.strip()
        if s.startswith('## '):
            if cur:
                blocks.append(cur)
            cur = {'request_id': s.replace('## ', '', 1).strip()}
        elif cur and s.startswith('- ') and ':' in s:
            k, v = s[2:].split(':', 1)
            cur[k.strip()] = v.strip()
    if cur:
        blocks.append(cur)
    return blocks


def normalize_status(v: str) -> str:
    s = (v or '').strip().lower()
    if s in ('new', 'ack', 'assigned'):
        return 'assigned'
    if s in ('in_progress', 'review'):
        return 'in_progress'
    if s in ('blocked',):
        return 'blocked'
    if s in ('done', 'verified', 'archived'):
        return 'done'
    return 'in_progress'


def difficulty_by_intent(intent: str) -> str:
    n = len((intent or '').split())
    if n <= 6:
        return 'simple'
    if n <= 16:
        return 'medium'
    return 'complex'


def _get_task_id(db_path: Path, request_id: str):
    with sqlite3.connect(str(db_path)) as conn:
        row = conn.execute('SELECT id FROM tasks WHERE request_id=?', (request_id,)).fetchone()
        return int(row[0]) if row else None


def sync_comm_log(monitor: AgentMonitor, db_path: Path = DB_PATH, comm_log: Path = COMM_LOG) -> int:
    text = comm_log.read_text(encoding='utf-8') if comm_log.exists() else ''
    blocks = parse_blocks(text)

    for b in blocks:
        req = b.get('request_id') or ''
        if not req:
            continue
        agent = b.get('to_agent') or 'unknown'
        intent = b.get('intent') or 'handoff task'
        status = normalize_status(b.get('status', 'in_progress'))
        progress = 100 if status == 'done' else (20 if status == 'assigned' else (40 if status == 'blocked' else 65))
        difficulty = difficulty_by_intent(intent)

        task_id = None
        try:
            task_id = monitor.assign_task(agent, intent, difficulty, request_id=req)
        except Exception:
            task_id = _get_task_id(db_path, req)

        if not task_id:
            continue

        activity = 'waiting' if status in ('assigned', 'blocked') else ('idle' if status == 'done' else 'executing')
        monitor.update_progress(task_id, status, progress, activity=activity)

    return len(blocks)


def sync_agent_states(db_path: Path = DB_PATH, workspaces: Path = WORKSPACES) -> int:
    if not workspaces.exists():
        return 0

    updated = 0
    with sqlite3.connect(str(db_path)) as conn:
        for ws in workspaces.iterdir():
            if not ws.is_dir():
                continue
            state_file = ws / 'STATE.json'
            if not state_file.exists():
                continue
            try:
                state = json.loads(state_file.read_text(encoding='utf-8'))
            except Exception:
                continue

            agent_id = state.get('agent_id') or f'{ws.name}-v1'
            status = (state.get('status') or 'UNKNOWN').lower()
            if status == 'ready':
                activity = 'idle'
            elif status == 'busy':
                activity = 'executing'
            elif status == 'blocked':
                activity = 'waiting'
            else:
                activity = 'waiting'

            current_req = state.get('current_request')
            task_id = _get_task_id(db_path, current_req) if current_req else None
            updated_at = state.get('updated_at') or ''

            conn.execute(
                """
                INSERT INTO agent_status (agent_id, activity, current_task_id, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(agent_id) DO UPDATE SET
                    activity=excluded.activity,
                    current_task_id=excluded.current_task_id,
                    updated_at=excluded.updated_at
                """,
                (agent_id, activity, task_id, updated_at),
            )
            updated += 1
    return updated


def sync_all(monitor: AgentMonitor, db_path: Path = DB_PATH) -> dict:
    ingested = sync_comm_log(monitor, db_path=db_path)
    state_updates = sync_agent_states(db_path=db_path)
    return {'comm_records': ingested, 'state_updates': state_updates}


def main():
    monitor = AgentMonitor(str(DB_PATH))
    result = sync_all(monitor, db_path=DB_PATH)
    print(f"synced: comm_records={result['comm_records']} state_updates={result['state_updates']}")


if __name__ == '__main__':
    main()
