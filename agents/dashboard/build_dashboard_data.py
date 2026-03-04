#!/usr/bin/env python3
import json
from pathlib import Path
from datetime import datetime

ROOT = Path('/Users/liumobei/.openclaw/workspace')
REGISTRY = ROOT / 'agents/registry/registry.yaml'
COMM_LOG = ROOT / 'agents/runs/COMM_LOG.md'
OUT = ROOT / 'agents/dashboard/data/dashboard-data.js'


def parse_registry(path: Path):
    agents = []
    lines = path.read_text(encoding='utf-8').splitlines()
    cur = None
    for line in lines:
        s = line.strip()
        if s.startswith('- agent_id:'):
            if cur:
                agents.append(cur)
            cur = {'agent_id': s.split(':', 1)[1].strip()}
        elif cur and ':' in s:
            k, v = s.split(':', 1)
            k = k.strip()
            v = v.strip().strip('"')
            if k in {'name', 'status', 'role', 'risk_level', 'workspace'}:
                cur[k] = v
    if cur:
        agents.append(cur)
    return agents


def read_state(workspace: str):
    p = Path(workspace) / 'STATE.json'
    if not p.exists():
        return {'status': 'UNKNOWN', 'current_request': None, 'updated_at': None}
    try:
        d = json.loads(p.read_text(encoding='utf-8'))
        return {
            'status': d.get('status', 'UNKNOWN'),
            'current_request': d.get('current_request'),
            'updated_at': d.get('updated_at')
        }
    except Exception:
        return {'status': 'BROKEN', 'current_request': None, 'updated_at': None}


def parse_comm(path: Path):
    if not path.exists():
        return []
    records = []
    cur = None
    for line in path.read_text(encoding='utf-8').splitlines():
        s = line.strip()
        if s.startswith('## '):
            if cur:
                records.append(cur)
            cur = {'request_id': s.replace('## ', '', 1)}
        elif cur and s.startswith('- ') and ':' in s:
            k, v = s[2:].split(':', 1)
            cur[k.strip()] = v.strip()
    if cur:
        records.append(cur)
    return records


agents = parse_registry(REGISTRY)
comm = parse_comm(COMM_LOG)

agent_cards = []
for a in agents:
    state = read_state(a.get('workspace', ''))
    agent_cards.append({
        'agent_id': a.get('agent_id'),
        'name': a.get('name', a.get('agent_id')),
        'role': a.get('role', ''),
        'risk_level': a.get('risk_level', ''),
        'registry_status': a.get('status', 'UNKNOWN'),
        'runtime_status': state.get('status', 'UNKNOWN'),
        'current_request': state.get('current_request'),
        'updated_at': state.get('updated_at')
    })

status_count = {}
for c in agent_cards:
    status_count[c['runtime_status']] = status_count.get(c['runtime_status'], 0) + 1

metrics = {
    'total_agents': len(agent_cards),
    'total_handoffs': len(comm),
    'ready_agents': status_count.get('READY', 0),
    'blocked_agents': status_count.get('BLOCKED', 0),
    'updated_at': datetime.now().isoformat(timespec='seconds')
}

payload = {
    'metrics': metrics,
    'agents': agent_cards,
    'handoffs': comm[-20:]
}

OUT.write_text('window.DASHBOARD_DATA = ' + json.dumps(payload, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
print(str(OUT))
