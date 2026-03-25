#!/usr/bin/env python3
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ACTIVE_TASKS = ROOT / "active-tasks.json"
TASK_HISTORY = ROOT / "task-history.jsonl"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_registry() -> dict:
    return json.loads(ACTIVE_TASKS.read_text())


def save_registry(registry: dict) -> None:
    registry["updated_at"] = now_iso()
    ACTIVE_TASKS.write_text(json.dumps(registry, indent=2, ensure_ascii=True) + "\n")


def append_history(event: dict) -> None:
    with TASK_HISTORY.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(event, ensure_ascii=True) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Record a retry / re-steer for a swarm task.")
    parser.add_argument("request_id")
    parser.add_argument("--reason", required=True)
    parser.add_argument("--note", action="append", default=[])
    parser.add_argument("--status", default="DISPATCHED", choices=["SCOPED", "DISPATCHED", "RUNNING", "BLOCKED"])
    args = parser.parse_args()

    registry = load_registry()
    task = next((t for t in registry["tasks"] if t["request_id"] == args.request_id), None)
    if not task:
        raise SystemExit(f"request_id not found: {args.request_id}")

    now = now_iso()
    task["retry_count"] = int(task.get("retry_count", 0)) + 1
    task["status"] = args.status
    task["status_changed_at"] = now
    task["blocked_reason"] = None if args.status != "BLOCKED" else args.reason
    task.setdefault("notes", []).append(f"retry#{task['retry_count']}: {args.reason}")
    for note in args.note:
        note = note.strip()
        if note:
            task["notes"].append(note)
    task["stale"] = {
        "is_stale": False,
        "reason": None,
        "age_seconds": 0,
        "threshold_seconds": None,
        "basis": "status_changed_at",
        "since": None,
    }
    task["updated_at"] = now

    save_registry(registry)
    append_history({
        "ts": now,
        "event": "TASK_RETRIED",
        "request_id": task["request_id"],
        "status": task["status"],
        "retry_count": task["retry_count"],
        "reason": args.reason,
    })
    print(json.dumps(task, indent=2, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
