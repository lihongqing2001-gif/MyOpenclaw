#!/usr/bin/env python3
import argparse
import json
import shlex
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ACTIVE_TASKS = ROOT / "active-tasks.json"
TASK_HISTORY = ROOT / "task-history.jsonl"
WORKTREES = ROOT / "worktrees"
LOGS = ROOT / "logs"

AGENT_CMDS = {
    "codex": "codex",
    "claude": "claude",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_registry() -> dict:
    if not ACTIVE_TASKS.exists():
        return {"version": 1, "updated_at": None, "tasks": []}
    return json.loads(ACTIVE_TASKS.read_text())


def save_registry(registry: dict) -> None:
    registry["updated_at"] = now_iso()
    ACTIVE_TASKS.write_text(json.dumps(registry, indent=2, ensure_ascii=True) + "\n")


def append_history(event: dict) -> None:
    TASK_HISTORY.parent.mkdir(parents=True, exist_ok=True)
    with TASK_HISTORY.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(event, ensure_ascii=True) + "\n")


def run_cmd(cmd: list[str], cwd: str | None = None) -> tuple[bool, str]:
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, text=True, cwd=cwd)
        return True, out.strip()
    except subprocess.CalledProcessError as exc:
        return False, exc.output.strip()


def which(cmd: str) -> str | None:
    ok, out = run_cmd(["/bin/sh", "-lc", f"command -v {shlex.quote(cmd)}"])
    return out if ok and out else None


def ensure_worktree(repo: str, branch: str | None, request_id: str) -> tuple[str | None, list[str]]:
    notes = []
    if not branch:
        return None, notes
    WORKTREES.mkdir(parents=True, exist_ok=True)
    worktree_path = WORKTREES / request_id
    if worktree_path.exists():
        notes.append(f"worktree already exists: {worktree_path}")
        return str(worktree_path), notes
    ok, _ = run_cmd(["git", "-C", repo, "rev-parse", "--verify", branch])
    if ok:
        ok_add, out_add = run_cmd(["git", "-C", repo, "worktree", "add", str(worktree_path), branch])
    else:
        ok_add, out_add = run_cmd(["git", "-C", repo, "worktree", "add", "-b", branch, str(worktree_path), "HEAD"])
    notes.append(out_add)
    if not ok_add:
        raise SystemExit(f"failed to create worktree: {out_add}")
    return str(worktree_path), notes


def spawn_with_tmux(agent_cmd: str, session_name: str, cwd: str, prompt: str, log_path: Path) -> tuple[str | None, int | None, str | None, list[str]]:
    notes = []
    cmd = f"cd {shlex.quote(cwd)} && {agent_cmd} {shlex.quote(prompt)} | tee -a {shlex.quote(str(log_path))}"
    ok, out = run_cmd(["tmux", "new-session", "-d", "-s", session_name, cmd])
    if not ok:
        return None, None, None, [f"tmux spawn failed: {out}"]
    ok_pid, pid_out = run_cmd(["tmux", "list-panes", "-t", session_name, "-F", "#{pane_pid}"])
    pid = int(pid_out.splitlines()[0]) if ok_pid and pid_out.splitlines() else None
    notes.append(f"spawned via tmux session={session_name}")
    return session_name, pid, str(log_path), notes


def spawn_with_popen(agent_cmd: str, cwd: str, prompt: str, log_path: Path) -> tuple[str | None, int | None, str | None, list[str]]:
    cmd = f"{agent_cmd} {shlex.quote(prompt)}"
    with log_path.open("ab") as logf:
        proc = subprocess.Popen(
            ["/bin/sh", "-lc", cmd],
            cwd=cwd,
            stdout=logf,
            stderr=subprocess.STDOUT,
            preexec_fn=None,
        )
    return None, proc.pid, str(log_path), [f"spawned via popen pid={proc.pid}"]


def spawn_session(args: argparse.Namespace, worktree_path: str | None) -> tuple[str | None, int | None, str | None, list[str], str]:
    if args.no_session:
        return None, None, None, [], "none"
    agent_cmd = AGENT_CMDS.get(args.agent)
    if not agent_cmd:
        return None, None, None, [f"no spawn command configured for agent {args.agent}"], "none"
    resolved = which(agent_cmd)
    if not resolved:
        return None, None, None, [f"agent command not found: {agent_cmd}"], "none"
    target_cwd = worktree_path or args.repo
    LOGS.mkdir(parents=True, exist_ok=True)
    log_path = LOGS / f"{args.request_id}.log"
    session_name = f"swarm-{args.request_id}"
    prompt = args.prompt or args.title
    if which("tmux"):
        session_key, session_pid, session_log, notes = spawn_with_tmux(resolved, session_name, target_cwd, prompt, log_path)
        if session_pid is not None:
            return session_key, session_pid, session_log, notes, "tmux"
    session_key, session_pid, session_log, notes = spawn_with_popen(resolved, target_cwd, prompt, log_path)
    return session_key, session_pid, session_log, notes, "popen"


def build_task(args: argparse.Namespace, worktree_path: str | None, session_key: str | None, session_pid: int | None, session_log: str | None, session_backend: str) -> dict:
    ts = now_iso()
    acceptance = [item.strip() for item in args.acceptance if item.strip()]
    notes = [item.strip() for item in args.note if item.strip()]
    task_notes = notes[:]
    if worktree_path:
        task_notes.append(f"worktree prepared: {worktree_path}")
    if session_log:
        task_notes.append(f"session log: {session_log}")
    return {
        "request_id": args.request_id,
        "title": args.title,
        "repo": args.repo,
        "agent": args.agent,
        "owner_agent": args.owner_agent,
        "agent_model": args.agent_model,
        "session_key": session_key,
        "session_pid": session_pid,
        "session_log": session_log,
        "session_backend": session_backend,
        "worktree_path": worktree_path,
        "branch": args.branch,
        "status": args.status,
        "status_changed_at": ts,
        "priority": args.priority,
        "risk_level": args.risk_level,
        "acceptance": acceptance,
        "expected_output": args.expected_output,
        "rollback_note": args.rollback_note,
        "notify_on_complete": args.notify_on_complete,
        "summary": None,
        "blocked_reason": None,
        "review_evidence": {"pr_url": None, "screenshot_urls": [], "review_notes": []},
        "checks": {
            "session_alive": bool(session_pid),
            "worktree_exists": bool(worktree_path and Path(worktree_path).exists()),
            "branch_exists": False,
            "branch_pushed": False,
            "pr_created": False,
            "ci_passed": False,
            "verified": False
        },
        "stale": {
            "is_stale": False,
            "reason": None,
            "age_seconds": 0,
            "threshold_seconds": None,
            "basis": "status_changed_at",
            "since": None
        },
        "retry_count": 0,
        "created_at": ts,
        "updated_at": ts,
        "notes": task_notes,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Register and dispatch a swarm task.")
    parser.add_argument("request_id")
    parser.add_argument("title")
    parser.add_argument("repo")
    parser.add_argument("--agent", default="codex")
    parser.add_argument("--owner-agent", default="main")
    parser.add_argument("--agent-model", default=None)
    parser.add_argument("--branch", default=None)
    parser.add_argument("--status", default="DISPATCHED", choices=["NEW", "SCOPED", "DISPATCHED", "RUNNING", "REVIEW", "BLOCKED", "FAILED", "DONE", "VERIFIED", "ARCHIVED"])
    parser.add_argument("--priority", default="medium", choices=["low", "medium", "high"])
    parser.add_argument("--risk-level", default="L2", choices=["L1", "L2", "L3"])
    parser.add_argument("--acceptance", action="append", default=[])
    parser.add_argument("--expected-output", default="")
    parser.add_argument("--rollback-note", default="")
    parser.add_argument("--notify-on-complete", action="store_true")
    parser.add_argument("--note", action="append", default=[])
    parser.add_argument("--prompt", default=None)
    parser.add_argument("--no-worktree", action="store_true")
    parser.add_argument("--no-session", action="store_true")
    args = parser.parse_args()

    registry = load_registry()
    if any(task["request_id"] == args.request_id for task in registry["tasks"]):
        raise SystemExit(f"request_id already exists: {args.request_id}")

    worktree_path = None
    if not args.no_worktree:
        worktree_path, worktree_notes = ensure_worktree(args.repo, args.branch, args.request_id)
        args.note.extend(worktree_notes)

    session_key, session_pid, session_log, spawn_notes, session_backend = spawn_session(args, worktree_path)
    args.note.extend(spawn_notes)
    if session_pid and args.status == "DISPATCHED":
        args.status = "RUNNING"

    task = build_task(args, worktree_path, session_key, session_pid, session_log, session_backend)
    registry["tasks"].append(task)
    save_registry(registry)
    append_history({
        "ts": now_iso(),
        "event": "TASK_DISPATCHED",
        "request_id": task["request_id"],
        "status": task["status"],
        "agent": task["agent"],
        "owner_agent": task["owner_agent"],
        "title": task["title"],
        "worktree_path": task["worktree_path"],
        "branch": task["branch"],
        "session_pid": task["session_pid"],
        "session_backend": task["session_backend"],
    })
    print(json.dumps(task, indent=2, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
