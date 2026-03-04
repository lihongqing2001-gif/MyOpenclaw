#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

from monitor import AgentMonitor

ROOT = Path('/Users/liumobei/.openclaw/workspace')
COMM_LOG = ROOT / 'agents/runs/COMM_LOG.md'
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


def main():
    monitor = AgentMonitor(str(DB_PATH))
    text = COMM_LOG.read_text(encoding='utf-8') if COMM_LOG.exists() else ''
    blocks = parse_blocks(text)

    for b in blocks:
        req = b.get('request_id') or ''
        agent = b.get('to_agent') or 'unknown'
        intent = b.get('intent') or 'handoff task'
        status = normalize_status(b.get('status', 'in_progress'))
        progress = 100 if status == 'done' else (20 if status == 'assigned' else (40 if status == 'blocked' else 65))
        difficulty = difficulty_by_intent(intent)

        # idempotent-ish by request_id unique constraint
        try:
            task_id = monitor.assign_task(agent, intent, difficulty, request_id=req)
        except Exception:
            # task already exists; fetch id from sqlite directly
            import sqlite3
            with sqlite3.connect(str(DB_PATH)) as conn:
                row = conn.execute('SELECT id FROM tasks WHERE request_id=?', (req,)).fetchone()
                if not row:
                    continue
                task_id = int(row[0])

        activity = 'waiting' if status in ('assigned', 'blocked') else ('idle' if status == 'done' else 'executing')
        monitor.update_progress(task_id, status, progress, activity=activity)

    print(f'ingested: {len(blocks)} from {COMM_LOG}')


if __name__ == '__main__':
    main()
