import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.workflow-8c040ba6", "name": "邮件回复草稿与发送建议", "version": "0.2.0", "description": "针对一封或一组邮件生成可直接使用的回复草稿，并给出发送建议。", "domain": "个人管理", "category": "日程规划与提醒", "tags": ["个人管理", "日程规划与提醒", "sop"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": [], "requires": ">=2026.3.2", "skills": ["skills/assistant-orchestrator/SKILL.md", "skills/email-sequence/SKILL.md"], "sops": ["sops/邮件回复草稿与发送建议.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.workflow-8c040ba6/"], "packaged_capabilities": ["cap.openclaw.skill.assistant-orchestrator", "cap.openclaw.skill.email-sequence"], "entrypoints": [{"label": "邮件回复草稿与发送建议", "command": "__OPENCLAW_WORKFLOW__ sop-邮件回复草稿与发送建议"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/邮件回复草稿与发送建议.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
