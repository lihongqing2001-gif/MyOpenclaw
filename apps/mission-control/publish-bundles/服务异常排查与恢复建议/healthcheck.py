import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.workflow-9a809a15", "name": "服务异常排查与恢复建议", "version": "0.2.0", "description": "在服务异常、页面打不开、任务卡死、健康检查异常时，快速形成一份排查与恢复建议。", "domain": "OpenClaw Workflow", "category": "综合工作流", "tags": ["OpenClaw Workflow", "综合工作流", "sop"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": [], "requires": ">=2026.3.2", "skills": [], "sops": ["sops/服务异常排查与恢复建议.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.workflow-9a809a15/"], "packaged_capabilities": [], "entrypoints": [{"label": "服务异常排查与恢复建议", "command": "__OPENCLAW_WORKFLOW__ sop-服务异常排查与恢复建议"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/服务异常排查与恢复建议.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
