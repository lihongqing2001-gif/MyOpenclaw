import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.content-project-extract-summary", "name": "关键内容提取与摘要", "version": "0.2.0", "description": "报告摘要、资料综述", "domain": "项目产出与资料管理", "category": "文件与资料管理", "tags": ["项目产出与资料管理", "文件与资料管理", "核心", "main"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": ["cap.openclaw.foundation.files-repo", "cap.openclaw.foundation.knowledge-index"], "requires": ">=2026.3.2", "skills": [], "sops": ["sops/关键内容提取与摘要.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.content-project-extract-summary/"], "packaged_capabilities": [], "entrypoints": [{"label": "关键内容提取与摘要", "command": "__OPENCLAW_WORKFLOW__ sop-content-project-extract-summary"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/关键内容提取与摘要.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
