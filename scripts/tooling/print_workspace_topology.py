#!/usr/bin/env python3
import json
from pathlib import Path


TOPOLOGY_PATH = Path(__file__).resolve().parents[2] / "workspace-topology.json"


def main() -> None:
    payload = json.loads(TOPOLOGY_PATH.read_text(encoding="utf-8"))
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
