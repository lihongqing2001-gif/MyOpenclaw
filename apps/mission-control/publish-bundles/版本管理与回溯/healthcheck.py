import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.content-project-version-trace", "name": "版本管理与回溯", "version": "0.2.0", "description": "交付追踪、历史回查", "domain": "项目产出与资料管理", "category": "文件与资料管理", "tags": ["项目产出与资料管理", "文件与资料管理", "基础", "main"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": ["cap.openclaw.foundation.files-repo"], "requires": ">=2026.3.2", "skills": [], "sops": ["sops/版本管理与回溯.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.content-project-version-trace/"], "packaged_capabilities": [], "entrypoints": [{"label": "版本管理与回溯", "command": "__OPENCLAW_WORKFLOW__ sop-content-project-version-trace"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/版本管理与回溯.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
