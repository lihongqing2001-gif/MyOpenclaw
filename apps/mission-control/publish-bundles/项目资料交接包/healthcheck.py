import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.workflow-d522a60e", "name": "项目资料交接包", "version": "0.2.0", "description": "把一个目录、项目或仓库整理成可以直接交给别人继续接手的交接包。", "domain": "项目产出与资料管理", "category": "文件与资料管理", "tags": ["项目产出与资料管理", "文件与资料管理", "sop"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": [], "requires": ">=2026.3.2", "skills": [], "sops": ["sops/项目资料交接包.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.workflow-d522a60e/"], "packaged_capabilities": [], "entrypoints": [{"label": "项目资料交接包", "command": "__OPENCLAW_WORKFLOW__ sop-项目资料交接包"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/项目资料交接包.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
