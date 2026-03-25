import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.content-project-file-index", "name": "资料清单化与索引", "version": "0.2.0", "description": "资料库盘点、审计", "domain": "项目产出与资料管理", "category": "文件与资料管理", "tags": ["项目产出与资料管理", "文件与资料管理", "核心", "main"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": ["cap.openclaw.foundation.files-repo"], "requires": ">=2026.3.2", "skills": [], "sops": ["sops/资料清单化与索引.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.content-project-file-index/"], "packaged_capabilities": [], "entrypoints": [{"label": "资料清单化与索引", "command": "python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_project_file_index.py --target-dir <目标目录>"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/资料清单化与索引.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
