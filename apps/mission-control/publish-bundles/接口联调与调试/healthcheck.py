import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.content-dev-integration", "name": "接口联调与调试", "version": "0.2.0", "description": "服务对接、联调测试", "domain": "项目产出与资料管理", "category": "编程", "tags": ["项目产出与资料管理", "编程", "核心", "main"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": ["cap.openclaw.foundation.files-repo"], "requires": ">=2026.3.2", "skills": [], "sops": ["sops/接口联调与调试.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.content-dev-integration/"], "packaged_capabilities": [], "entrypoints": [{"label": "接口联调与调试", "command": "__OPENCLAW_WORKFLOW__ sop-content-dev-integration"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/接口联调与调试.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
