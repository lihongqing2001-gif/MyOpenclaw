#!/usr/bin/env python3
import json
import os
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ACTIVE_TASKS = ROOT / "active-tasks.json"
TASK_HISTORY = ROOT / "task-history.jsonl"

STALE_THRESHOLDS = {
    "NEW": 4 * 60 * 60,
    "SCOPED": 4 * 60 * 60,
    "DISPATCHED": 30 * 60,
    "RUNNING": 2 * 60 * 60,
    "REVIEW": 4 * 60 * 60,
    "BLOCKED": 8 * 60 * 60,
}


def now_dt() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_dt().isoformat()


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def load_registry() -> dict:
    if not ACTIVE_TASKS.exists():
        return {"version": 1, "updated_at": None, "tasks": []}
    return json.loads(ACTIVE_TASKS.read_text())


def save_registry(registry: dict) -> None:
    registry["updated_at"] = now_iso()
    ACTIVE_TASKS.write_text(json.dumps(registry, indent=2, ensure_ascii=True) + "\n")


def append_history(event: dict) -> None:
    with TASK_HISTORY.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(event, ensure_ascii=True) + "\n")


def run_cmd(cmd: list[str], cwd: str | None = None) -> tuple[bool, str]:
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, text=True, cwd=cwd)
        return True, out.strip()
    except subprocess.CalledProcessError as exc:
        return False, exc.output.strip()


def run_git(repo: str, args: list[str]) -> tuple[bool, str]:
    return run_cmd(["git", "-C", repo, *args])


def branch_exists(repo: str, branch: str | None) -> bool:
    if not branch:
        return False
    ok, _ = run_git(repo, ["rev-parse", "--verify", branch])
    return ok


def branch_pushed(repo: str, branch: str | None) -> bool:
    if not branch:
        return False
    ok, out = run_git(repo, ["ls-remote", "--heads", "origin", branch])
    return ok and bool(out)


def session_alive(task: dict) -> bool:
    pid = task.get("session_pid")
    if isinstance(pid, int) and pid > 0:
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False
    return False


def gh_pr_info(repo: str, branch: str | None) -> tuple[bool, dict | None]:
    if not branch:
        return False, None
    ok, out = run_cmd([
        "gh", "pr", "list",
        "--repo", repo,
        "--head", branch,
        "--state", "open",
        "--json", "number,url,statusCheckRollup"
    ])
    if not ok:
        return False, None
    try:
        items = json.loads(out)
    except json.JSONDecodeError:
        return False, None
    if not items:
        return True, None
    return True, items[0]


def ci_passed_from_pr(pr_info: dict | None) -> bool:
    if not pr_info:
        return False
    checks = pr_info.get("statusCheckRollup") or []
    if not checks:
        return False
    states = []
    for item in checks:
        state = item.get("conclusion") or item.get("state") or ""
        if state:
            states.append(state.upper())
    return bool(states) and all(state in {"SUCCESS", "NEUTRAL", "SKIPPED"} for state in states)


def ensure_stale_fields(task: dict) -> None:
    anchor = task.get("status_changed_at") or task.get("updated_at") or task.get("created_at") or now_iso()
    task.setdefault("status_changed_at", anchor)
    task.setdefault(
        "stale",
        {
            "is_stale": False,
            "reason": None,
            "age_seconds": 0,
            "threshold_seconds": None,
            "basis": "status_changed_at",
            "since": None,
        },
    )


def update_stale_state(task: dict, current_time: datetime) -> list[str]:
    notes = []
    ensure_stale_fields(task)
    stale = task["stale"]
    threshold_seconds = STALE_THRESHOLDS.get(task["status"])
    anchor_dt = parse_iso(task.get("status_changed_at")) or parse_iso(task.get("created_at")) or current_time
    age_seconds = max(0, int((current_time - anchor_dt).total_seconds()))
    is_stale = bool(threshold_seconds is not None and age_seconds >= threshold_seconds)
    reason = None
    since = None
    if is_stale:
        reason = f"status {task['status']} has not changed for {age_seconds}s"
        since = (anchor_dt + timedelta(seconds=threshold_seconds)).isoformat() if threshold_seconds is not None else None

    was_stale = bool(stale.get("is_stale"))
    stale.update(
        {
            "is_stale": is_stale,
            "reason": reason,
            "age_seconds": age_seconds,
            "threshold_seconds": threshold_seconds,
            "basis": "status_changed_at",
            "since": since,
        }
    )

    if is_stale and not was_stale:
        notes.append(f"task marked stale after {age_seconds}s in {task['status']}")
    elif was_stale and not is_stale:
        notes.append("task is no longer stale")
    return notes


def refresh_task(task: dict) -> tuple[dict, list[str]]:
    notes = []
    current_ts = now_iso()
    current_time = parse_iso(current_ts) or now_dt()
    ensure_stale_fields(task)
    previous_status = task["status"]
    repo = task["repo"]
    worktree_path = task.get("worktree_path")
    task["checks"]["session_alive"] = session_alive(task)
    task["checks"]["worktree_exists"] = bool(worktree_path and Path(worktree_path).exists())
    task["checks"]["branch_exists"] = branch_exists(repo, task.get("branch"))
    task["checks"]["branch_pushed"] = branch_pushed(repo, task.get("branch"))

    gh_ok, pr_info = gh_pr_info(repo, task.get("branch"))
    if gh_ok and pr_info:
        task["checks"]["pr_created"] = True
        task["checks"]["ci_passed"] = ci_passed_from_pr(pr_info)
        task["pr_number"] = pr_info.get("number")
        task["review_evidence"]["pr_url"] = pr_info.get("url")
    else:
        task["checks"]["pr_created"] = False
        task["checks"]["ci_passed"] = False
        task.pop("pr_number", None)
        task["review_evidence"]["pr_url"] = None

    task["blocked_reason"] = None
    if task["status"] == "DISPATCHED":
        if task["checks"]["session_alive"]:
            task["status"] = "RUNNING"
            notes.append("status advanced to RUNNING because process evidence exists")
        elif not task["checks"]["worktree_exists"]:
            task["status"] = "BLOCKED"
            task["blocked_reason"] = "worktree missing after dispatch"
            notes.append("status changed to BLOCKED because worktree is missing")
    elif task["status"] == "RUNNING":
        if task["checks"]["pr_created"]:
            task["status"] = "REVIEW"
            notes.append("status advanced to REVIEW because PR exists")
        elif not task["checks"]["session_alive"]:
            task["status"] = "BLOCKED"
            task["blocked_reason"] = "session process not alive"
            notes.append("status changed to BLOCKED because session process is not alive")
    elif task["status"] == "REVIEW" and task["checks"]["ci_passed"]:
        task["status"] = "DONE"
        notes.append("status advanced to DONE because PR exists and CI passed")

    if task["status"] != previous_status:
        task["status_changed_at"] = current_ts

    notes.extend(update_stale_state(task, current_time))
    task["updated_at"] = current_ts
    return task, notes


def main() -> int:
    registry = load_registry()
    changed = []
    for idx, task in enumerate(registry["tasks"]):
        before = json.dumps(task, sort_keys=True)
        task, notes = refresh_task(task)
        registry["tasks"][idx] = task
        after = json.dumps(task, sort_keys=True)
        if before != after:
            changed.append({"request_id": task["request_id"], "status": task["status"], "notes": notes})
            append_history({
                "ts": now_iso(),
                "event": "TASK_REFRESHED",
                "request_id": task["request_id"],
                "status": task["status"],
                "notes": notes,
            })
    save_registry(registry)
    print(json.dumps({"updated_at": registry["updated_at"], "tasks": registry["tasks"], "changed": changed}, indent=2, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
