import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any


@lru_cache(maxsize=1)
def read_workspace_topology() -> dict[str, Any]:
    topology_path = os.environ.get("OPENCLAW_TOPOLOGY_PATH")
    if topology_path:
        resolved = Path(topology_path).expanduser().resolve()
    else:
        resolved = Path(__file__).resolve().parents[3] / "workspace-topology.json"
    if not resolved.exists():
        raise SystemExit(f"workspace-topology.json not found: {resolved}")
    return json.loads(resolved.read_text(encoding="utf-8"))


def repo_root() -> Path:
    return Path(read_workspace_topology()["repoRoot"]).expanduser().resolve()


def runtime_root() -> Path:
    return Path(read_workspace_topology()["runtimeRoot"]).expanduser().resolve()


def external_projects_root() -> Path:
    return Path(read_workspace_topology()["externalProjectsRoot"]).expanduser().resolve()
