import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.workflow-9fe1238c", "name": "技能缺口检查与安装计划", "version": "0.2.0", "description": "针对一个目标 SOP 或目标任务，检查当前缺少哪些技能、能力包或集成，并输出安装与验证计划。", "domain": "OpenClaw Workflow", "category": "综合工作流", "tags": ["OpenClaw Workflow", "综合工作流", "sop"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": [], "requires": ">=2026.3.2", "skills": ["skills/find-skills/SKILL.md"], "sops": ["sops/技能缺口检查与安装计划.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.workflow-9fe1238c/"], "packaged_capabilities": ["cap.openclaw.skill.find-skills"], "entrypoints": [{"label": "技能缺口检查与安装计划", "command": "__OPENCLAW_WORKFLOW__ sop-技能缺口检查与安装计划"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/技能缺口检查与安装计划.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
