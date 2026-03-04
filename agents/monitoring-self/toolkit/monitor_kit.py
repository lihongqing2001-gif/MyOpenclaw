#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
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


def _load_config() -> dict:
    if CONFIG.exists():
        return json.loads(CONFIG.read_text(encoding="utf-8"))
    return {
        "owner": "董事长",
        "default_seed_agent": "designer-v1",
        "default_difficulty": "medium",
        "host": "127.0.0.1",
        "port": 8000,
    }


def _venv_python() -> Path:
    return VENV / "bin" / "python"


def _venv_uvicorn() -> Path:
    return VENV / "bin" / "uvicorn"


def _is_port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.3)
        return s.connect_ex((host, port)) == 0


def cmd_doctor(_: argparse.Namespace) -> int:
    cfg = _load_config()
    host = cfg.get("host", "127.0.0.1")
    port = int(cfg.get("port", 8000))

    checks: list[tuple[str, bool, str]] = []

    workspace = ROOT.parents[1]
    checks.append(("workspace_exists", workspace.exists(), str(workspace)))
    checks.append(("backend_exists", BACKEND.exists(), str(BACKEND)))
    checks.append(("frontend_exists", FRONTEND.exists(), str(FRONTEND)))
    checks.append(("venv_exists", _venv_python().exists(), str(_venv_python())))
    checks.append(("db_exists", DB.exists(), str(DB)))

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
    if not DB.exists():
        print(f"- run: {ROOT}/monitor-kit start")
    if not comm.exists():
        print("- create agents/runs/COMM_LOG.md or enable your handoff pipeline")

    print("\n[openclaw.json patch]")
    patch = {
        "tools": {"agentToAgent": {"enabled": True}},
        "agents": {
            "designer": {"agentDir": str(workspace / "agents" / "workspaces" / "designer")},
            "admin": {"agentDir": str(workspace / "agents" / "workspaces" / "admin")},
            "engineer": {"agentDir": str(workspace / "agents" / "workspaces" / "engineer")},
            "executor": {"agentDir": str(workspace / "agents" / "workspaces" / "executor")},
            "life-assistant": {"agentDir": str(workspace / "agents" / "workspaces" / "life-assistant")},
        },
    }
    print(json.dumps(patch, ensure_ascii=False, indent=2))
    return 0 if all_ok else 2


def cmd_setup(args: argparse.Namespace) -> int:
    cfg = _load_config()
    if args.non_interactive:
        CONFIG.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
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
    CONFIG.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
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
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="monitor-kit")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("doctor")
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

    return p


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
