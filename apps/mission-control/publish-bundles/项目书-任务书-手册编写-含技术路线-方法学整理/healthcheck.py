import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.content-research-docs", "name": "项目书/任务书/手册编写（含技术路线/方法学整理）", "version": "0.2.0", "description": "科研任务书、项目书、手册", "domain": "项目产出与资料管理", "category": "科研", "tags": ["项目产出与资料管理", "科研", "核心", "main"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": ["cap.openclaw.foundation.files-repo", "cap.openclaw.foundation.knowledge-index"], "requires": ">=2026.3.2", "skills": [], "sops": ["sops/项目书-任务书-手册编写-含技术路线-方法学整理.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.content-research-docs/"], "packaged_capabilities": [], "entrypoints": [{"label": "项目书/任务书/手册编写（含技术路线/方法学整理）", "command": "__OPENCLAW_WORKFLOW__ sop-content-research-docs"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/项目书-任务书-手册编写-含技术路线-方法学整理.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
