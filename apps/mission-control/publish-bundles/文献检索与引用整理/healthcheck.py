import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.content-research-literature", "name": "文献检索与引用整理", "version": "0.2.0", "description": "综述写作、资料支撑", "domain": "项目产出与资料管理", "category": "科研", "tags": ["项目产出与资料管理", "科研", "基础", "main"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": ["cap.openclaw.foundation.browser-ops", "cap.openclaw.foundation.knowledge-index", "cap.openclaw.foundation.web-search"], "requires": ">=2026.3.2", "skills": [], "sops": ["sops/文献检索与引用整理.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.content-research-literature/"], "packaged_capabilities": [], "entrypoints": [{"label": "文献检索与引用整理", "command": "__OPENCLAW_WORKFLOW__ sop-content-research-literature"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/文献检索与引用整理.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
