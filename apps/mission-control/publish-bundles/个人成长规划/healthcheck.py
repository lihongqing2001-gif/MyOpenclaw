import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.content-growth-plan", "name": "个人成长规划", "version": "0.2.0", "description": "季度/年度成长规划、技能路线", "domain": "个人管理", "category": "日志与复盘", "tags": ["个人管理", "日志与复盘", "核心", "main"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": ["cap.openclaw.foundation.files-repo", "cap.openclaw.foundation.knowledge-index"], "requires": ">=2026.3.2", "skills": [], "sops": ["sops/个人成长规划.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.content-growth-plan/"], "packaged_capabilities": [], "entrypoints": [{"label": "个人成长规划", "command": "/growth plan --goal <目标> --cycle <周期>"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/个人成长规划.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
