#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend" / "index.html"
DATA = ROOT / "data"
DB = DATA / "monitor.db"
VENV = BACKEND / ".venv"
PID_FILE = ROOT / ".monitor-kit.pid"
LOG_FILE = ROOT / "data" / "monitor-kit.log"
CONFIG = ROOT / "toolkit" / "config.json"
CONFIG_EXAMPLE = ROOT / "toolkit" / "config.example.json"
PATCH_FILE = ROOT / "toolkit" / "openclaw.patch.json"


def _default_config() -> dict:
    return {
        "owner": "董事长",
        "default_seed_agent": "designer-v1",
        "default_difficulty": "medium",
        "host": "127.0.0.1",
        "port": 8000,
    }


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _load_config() -> dict:
    if CONFIG.exists():
        return _load_json(CONFIG)
    if CONFIG_EXAMPLE.exists():
        return _load_json(CONFIG_EXAMPLE)
    return _default_config()


def _venv_python() -> Path:
    return VENV / "bin" / "python"


def _venv_uvicorn() -> Path:
    return VENV / "bin" / "uvicorn"


def _is_port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.3)
        return s.connect_ex((host, port)) == 0


def _build_openclaw_patch() -> dict:
    workspace = ROOT.parents[1]
    return {
        "tools": {"agentToAgent": {"enabled": True}},
        "agents": {
            "designer": {"agentDir": str(workspace / "agents" / "workspaces" / "designer")},
            "admin": {"agentDir": str(workspace / "agents" / "workspaces" / "admin")},
            "engineer": {"agentDir": str(workspace / "agents" / "workspaces" / "engineer")},
            "executor": {"agentDir": str(workspace / "agents" / "workspaces" / "executor")},
            "life-assistant": {"agentDir": str(workspace / "agents" / "workspaces" / "life-assistant")},
        },
    }


def _ensure_patch_file() -> None:
    patch = _build_openclaw_patch()
    PATCH_FILE.write_text(json.dumps(patch, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _init_backend_db() -> tuple[bool, str]:
    python = _venv_python()
    if not python.exists():
        return False, f"venv missing: {python}"

    cmd = [
        str(python),
        "-c",
        (
            "from ingest_comm_log import DB_PATH; "
            "from monitor import AgentMonitor; "
            "AgentMonitor(str(DB_PATH)); "
            "print(DB_PATH)"
        ),
    ]
    proc = subprocess.run(cmd, cwd=str(BACKEND), capture_output=True, text=True)
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout).strip() or "backend init failed"
        return False, err
    return True, proc.stdout.strip()


def cmd_doctor(args: argparse.Namespace) -> int:
    cfg = _load_config()
    host = cfg.get("host", "127.0.0.1")
    port = int(cfg.get("port", 8000))

    if args.fix:
        if not CONFIG.exists():
            source = CONFIG_EXAMPLE if CONFIG_EXAMPLE.exists() else None
            if source is not None:
                CONFIG.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
                print(f"[fix] generated {CONFIG} from {source}")
            else:
                CONFIG.write_text(json.dumps(_default_config(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                print(f"[fix] generated {CONFIG} from built-in defaults")

        if not DATA.exists():
            DATA.mkdir(parents=True, exist_ok=True)
            print(f"[fix] created directory {DATA}")

        if not DB.exists():
            ok, detail = _init_backend_db()
            if ok:
                print(f"[fix] initialized backend DB: {detail}")
            else:
                print(f"[fix] failed to initialize DB: {detail}", file=sys.stderr)

    checks: list[tuple[str, bool, str]] = []

    workspace = ROOT.parents[1]
    checks.append(("workspace_exists", workspace.exists(), str(workspace)))
    checks.append(("backend_exists", BACKEND.exists(), str(BACKEND)))
    checks.append(("frontend_exists", FRONTEND.exists(), str(FRONTEND)))
    checks.append(("venv_exists", _venv_python().exists(), str(_venv_python())))
    checks.append(("data_exists", DATA.exists(), str(DATA)))
    checks.append(("db_exists", DB.exists(), str(DB)))
    checks.append(("config_exists", CONFIG.exists(), str(CONFIG)))

    comm = workspace / "agents" / "runs" / "COMM_LOG.md"
    checks.append(("comm_log_exists", comm.exists(), str(comm)))

    expected_agents = ["designer", "admin", "engineer", "executor", "life-assistant"]
    for a in expected_agents:
        s = workspace / "agents" / "workspaces" / a / "STATE.json"
        checks.append((f"state_{a}", s.exists(), str(s)))

    checks.append(("port_occupied", _is_port_open(host, port), f"{host}:{port}"))

    all_ok = True
    print("[monitor-kit doctor]")
    for name, ok, detail in checks:
        mark = "PASS" if ok else "FAIL"
        if not ok and name == "port_occupied":
            mark = "WARN"
        print(f"- {mark:4} {name}: {detail}")
        if not ok and name != "port_occupied":
            all_ok = False

    print("\n[fix suggestions]")
    if not _venv_python().exists():
        print(f"- run: {ROOT}/install.sh")
    if not CONFIG.exists():
        print(f"- run: {ROOT}/monitor-kit doctor --fix")
    if not DATA.exists() or not DB.exists():
        print(f"- run: {ROOT}/monitor-kit doctor --fix")
    if not comm.exists():
        print("- create agents/runs/COMM_LOG.md or enable your handoff pipeline")

    _ensure_patch_file()
    print("\n[openclaw.json patch]")
    print(json.dumps(_build_openclaw_patch(), ensure_ascii=False, indent=2))
    print(f"[patch file] {PATCH_FILE}")
    return 0 if all_ok else 2


def cmd_setup(args: argparse.Namespace) -> int:
    cfg = _load_config()
    if args.non_interactive:
        CONFIG.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {CONFIG}")
        return 0

    owner = input(f"owner [{cfg['owner']}]: ").strip() or cfg["owner"]
    seed = input(f"default_seed_agent [{cfg['default_seed_agent']}]: ").strip() or cfg["default_seed_agent"]
    diff = input(f"default_difficulty [{cfg['default_difficulty']}]: ").strip() or cfg["default_difficulty"]
    host = input(f"host [{cfg['host']}]: ").strip() or cfg["host"]
    port_raw = input(f"port [{cfg['port']}]: ").strip() or str(cfg["port"])

    out = {
        "owner": owner,
        "default_seed_agent": seed,
        "default_difficulty": diff,
        "host": host,
        "port": int(port_raw),
    }
    CONFIG.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {CONFIG}")
    return 0


def _pid_running(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def cmd_start(_: argparse.Namespace) -> int:
    cfg = _load_config()
    host = cfg.get("host", "127.0.0.1")
    port = int(cfg.get("port", 8000))

    if PID_FILE.exists():
        pid = int(PID_FILE.read_text().strip())
        if _pid_running(pid):
            print(f"already running pid={pid}")
            return 0

    DATA.mkdir(parents=True, exist_ok=True)
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

    uvicorn = _venv_uvicorn()
    if not uvicorn.exists():
        print("uvicorn not found in venv, run install.sh first", file=sys.stderr)
        return 2

    with LOG_FILE.open("a", encoding="utf-8") as log:
        p = subprocess.Popen(
            [str(uvicorn), "app:app", "--host", host, "--port", str(port)],
            cwd=str(BACKEND),
            stdout=log,
            stderr=log,
            start_new_session=True,
        )
    PID_FILE.write_text(str(p.pid), encoding="utf-8")
    print(f"started pid={p.pid} http://{host}:{port}")
    print(f"frontend: {FRONTEND}")
    return 0


def cmd_stop(_: argparse.Namespace) -> int:
    if not PID_FILE.exists():
        print("not running")
        return 0
    pid = int(PID_FILE.read_text().strip())
    try:
        os.kill(pid, signal.SIGTERM)
        print(f"stopped pid={pid}")
    except OSError:
        print(f"pid {pid} not running")
    PID_FILE.unlink(missing_ok=True)
    return 0


def cmd_status(_: argparse.Namespace) -> int:
    cfg = _load_config()
    host = cfg.get("host", "127.0.0.1")
    port = int(cfg.get("port", 8000))
    if PID_FILE.exists():
        pid = int(PID_FILE.read_text().strip())
        print(f"pid={pid} running={_pid_running(pid)}")
    else:
        print("pid=none")
    print(f"port_open={_is_port_open(host, port)} {host}:{port}")
    print(f"frontend={FRONTEND}")
    print(f"log={LOG_FILE}")
    print(f"config={CONFIG}")
    print(f"patch={PATCH_FILE}")
    return 0


def cmd_export(args: argparse.Namespace) -> int:
    out_dir = Path(args.path).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    if not CONFIG.exists():
        print(f"missing config: {CONFIG}. run monitor-kit setup or doctor --fix first", file=sys.stderr)
        return 2

    _ensure_patch_file()
    shutil.copy2(CONFIG, out_dir / "config.json")
    shutil.copy2(PATCH_FILE, out_dir / "openclaw.patch.json")
    print(f"exported config.json -> {out_dir / 'config.json'}")
    print(f"exported openclaw.patch.json -> {out_dir / 'openclaw.patch.json'}")
    return 0


def cmd_import(args: argparse.Namespace) -> int:
    src_dir = Path(args.path).expanduser().resolve()
    src_config = src_dir / "config.json"
    src_patch = src_dir / "openclaw.patch.json"

    if not src_config.exists() or not src_patch.exists():
        print(f"import requires both {src_config} and {src_patch}", file=sys.stderr)
        return 2

    _load_json(src_config)
    _load_json(src_patch)

    CONFIG.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src_config, CONFIG)
    shutil.copy2(src_patch, PATCH_FILE)
    print(f"imported config -> {CONFIG}")
    print(f"imported patch -> {PATCH_FILE}")
    return 0




def _monitor():
    sys.path.append(str(BACKEND))
    from monitor import AgentMonitor

    return AgentMonitor(str(DB))


def cmd_dispatch(args: argparse.Namespace) -> int:
    m = _monitor()
    main_task_id = args.main_task_id
    if main_task_id is None:
        if not args.main_title:
            print('need --main-title when --main-task-id is missing', file=sys.stderr)
            return 2
        main_task_id = m.create_main_task(args.main_title, owner=args.owner, status='in_progress')
    tid = m.assign_task(
        args.agent_id,
        args.task_desc,
        args.difficulty,
        request_id=args.request_id,
        main_task_id=main_task_id,
        risk_level='L2',
    )
    m.update_progress(tid, 'in_progress', args.progress, activity='executing')
    m.log_event('task_dispatched', 'main', f'spawned {args.agent_id} run={args.run_id or "-"}', request_id=args.request_id)
    print(json.dumps({'main_task_id': main_task_id, 'task_id': tid}, ensure_ascii=False))
    return 0


def cmd_complete(args: argparse.Namespace) -> int:
    m = _monitor()
    import sqlite3

    with sqlite3.connect(str(DB)) as conn:
        row = conn.execute('SELECT id FROM tasks WHERE request_id=? ORDER BY id DESC LIMIT 1', (args.request_id,)).fetchone()
    if not row:
        print('request_id not found', file=sys.stderr)
        return 2
    tid = int(row[0])
    m.update_progress(tid, 'done', 100, activity='idle')
    m.log_event('task_completed', 'main', f'completed request={args.request_id}', request_id=args.request_id)
    print(json.dumps({'task_id': tid, 'status': 'done'}, ensure_ascii=False))
    return 0

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="monitor-kit")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("doctor")
    s.add_argument("--fix", action="store_true", help="auto-fix safe issues")
    s.set_defaults(func=cmd_doctor)

    s = sub.add_parser("setup")
    s.add_argument("--non-interactive", action="store_true")
    s.set_defaults(func=cmd_setup)

    s = sub.add_parser("start")
    s.set_defaults(func=cmd_start)

    s = sub.add_parser("stop")
    s.set_defaults(func=cmd_stop)

    s = sub.add_parser("status")
    s.set_defaults(func=cmd_status)

    s = sub.add_parser("export")
    s.add_argument("path", nargs="?", default=str(ROOT / "toolkit" / "exports"))
    s.set_defaults(func=cmd_export)

    s = sub.add_parser("import")
    s.add_argument("path")
    s.set_defaults(func=cmd_import)

    s = sub.add_parser("dispatch")
    s.add_argument("--main-task-id", type=int)
    s.add_argument("--main-title")
    s.add_argument("--owner", default="董事长")
    s.add_argument("--agent-id", required=True)
    s.add_argument("--task-desc", required=True)
    s.add_argument("--difficulty", default="medium")
    s.add_argument("--request-id")
    s.add_argument("--run-id")
    s.add_argument("--progress", type=int, default=30)
    s.set_defaults(func=cmd_dispatch)

    s = sub.add_parser("complete")
    s.add_argument("--request-id", required=True)
    s.set_defaults(func=cmd_complete)

    return p


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
