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
    parser = argparse.ArgumentParser(description="Collect and summarize a swarm task.")
    parser.add_argument("request_id")
    parser.add_argument("--summary", required=True)
    parser.add_argument("--review-note", action="append", default=[])
    parser.add_argument("--screenshot-url", action="append", default=[])
    parser.add_argument("--status", default="VERIFIED", choices=["DONE", "VERIFIED", "ARCHIVED"])
    args = parser.parse_args()

    registry = load_registry()
    task = next((t for t in registry["tasks"] if t["request_id"] == args.request_id), None)
    if not task:
        raise SystemExit(f"request_id not found: {args.request_id}")

    now = now_iso()
    task["summary"] = args.summary
    task["review_evidence"]["review_notes"].extend([x.strip() for x in args.review_note if x.strip()])
    task["review_evidence"]["screenshot_urls"].extend([x.strip() for x in args.screenshot_url if x.strip()])
    task["status"] = args.status
    task["status_changed_at"] = now
    task.setdefault("stale", {})
    task["stale"].update(
        {
            "is_stale": False,
            "reason": None,
            "age_seconds": 0,
            "threshold_seconds": None,
            "basis": "status_changed_at",
            "since": None,
        }
    )
    if args.status == "VERIFIED":
        task["checks"]["verified"] = True
    task["updated_at"] = now

    save_registry(registry)
    append_history({
        "ts": now_iso(),
        "event": "TASK_COLLECTED",
        "request_id": task["request_id"],
        "status": task["status"],
        "summary": task["summary"],
    })
    print(json.dumps(task, indent=2, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
