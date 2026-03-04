#!/usr/bin/env python3
import re
from pathlib import Path
from datetime import datetime

ROOT = Path('/Users/liumobei/.openclaw/workspace')
COMM_LOG = ROOT / 'agents/runs/COMM_LOG.md'
L3_DIR = ROOT / 'agents/knowledge/L3-postmortems'
L4_DIR = ROOT / 'agents/knowledge/L4-snippets'
SUMMARY = ROOT / 'agents/evolution/DAILY_DIGEST.md'


def parse_comm_log(text: str):
    blocks = []
    current = None
    for line in text.splitlines():
        if line.startswith('## '):
            if current:
                blocks.append(current)
            current = {'request_id': line.replace('## ', '').strip()}
        elif current and line.startswith('- ') and ':' in line:
            k, v = line[2:].split(':', 1)
            current[k.strip()] = v.strip()
    if current:
        blocks.append(current)
    return blocks


def main():
    now = datetime.now()
    stamp = now.strftime('%Y-%m-%d %H:%M:%S')

    comm_text = COMM_LOG.read_text(encoding='utf-8') if COMM_LOG.exists() else ''
    records = parse_comm_log(comm_text)

    total = len(records)
    done = sum(1 for r in records if r.get('status', '').upper() == 'DONE')
    blocked = sum(1 for r in records if r.get('status', '').upper() == 'BLOCKED')

    failures = [r for r in records if r.get('status', '').upper() in ('BLOCKED', 'FAILED', 'ERROR')]

    lines = []
    lines.append('# Daily Knowledge Digest')
    lines.append('')
    lines.append(f'- generated_at: {stamp}')
    lines.append(f'- total_handoffs: {total}')
    lines.append(f'- done: {done}')
    lines.append(f'- blocked_or_failed: {len(failures)}')
    lines.append('')
    lines.append('## Recent Handoffs')
    if records:
        for r in records[-10:]:
            lines.append(f"- {r.get('request_id','-')}: {r.get('from_agent','-')} -> {r.get('to_agent','-')} [{r.get('status','-')}]")
    else:
        lines.append('- none')

    lines.append('')
    lines.append('## Promotion Suggestions')
    if failures:
        lines.append('- Create/append postmortem in L3 for each blocked/failed hop')
        for r in failures:
            rid = r.get('request_id', 'unknown').replace('/', '-').replace(' ', '-')
            pm = L3_DIR / f'{now.strftime("%Y-%m-%d")}-{rid}.md'
            if not pm.exists():
                pm.write_text(
                    '\n'.join([
                        f'# Postmortem: {r.get("request_id", "unknown")}',
                        '',
                        '## Incident',
                        f'- request_id: {r.get("request_id", "unknown")}',
                        f'- date: {now.strftime("%Y-%m-%d")}',
                        '',
                        '## What happened',
                        f'- status: {r.get("status", "unknown")}',
                        f'- from: {r.get("from_agent", "unknown")}',
                        f'- to: {r.get("to_agent", "unknown")}',
                        '',
                        '## Root cause',
                        '- TBD',
                        '',
                        '## Fix applied',
                        '- TBD',
                        '',
                        '## Preventive guard added',
                        '- TBD',
                        ''
                    ]),
                    encoding='utf-8'
                )
            lines.append(f'- postmortem_file: {pm}')
    else:
        lines.append('- No failures found; promote one successful pattern to L4 snippets.')
        snippet = L4_DIR / f'{now.strftime("%Y-%m-%d")}-successful-handoff-pattern.md'
        if not snippet.exists() and records:
            r = records[-1]
            snippet.write_text(
                '\n'.join([
                    '# Successful Handoff Pattern',
                    '',
                    f'- request_id: {r.get("request_id", "unknown")}',
                    f'- route: {r.get("from_agent", "-")} -> {r.get("to_agent", "-")}',
                    f'- status: {r.get("status", "-")}',
                    '',
                    'Template:',
                    '- objective: clear and testable',
                    '- expected_output: file path + schema',
                    '- verification: read-back + status',
                    '- closure: log to COMM_LOG + OUTBOX',
                    ''
                ]),
                encoding='utf-8'
            )
            lines.append(f'- snippet_file: {snippet}')

    SUMMARY.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(SUMMARY)


if __name__ == '__main__':
    main()
