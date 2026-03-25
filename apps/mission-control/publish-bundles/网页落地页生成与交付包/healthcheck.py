import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.workflow-1dcf62c4", "name": "网页落地页生成与交付包", "version": "0.2.0", "description": "围绕一个主题、产品或活动，输出一套可直接交付的网页落地页方案。", "domain": "项目产出与资料管理", "category": "编程", "tags": ["项目产出与资料管理", "编程", "sop"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": [], "requires": ">=2026.3.2", "skills": ["skills/ai-image-generation/SKILL.md", "skills/assistant-orchestrator/SKILL.md", "skills/frontend-design/SKILL.md", "skills/penpot-uiux-design/SKILL.md", "skills/video-prompting-guide/SKILL.md", "skills/web-design-guidelines/SKILL.md"], "sops": ["sops/网页落地页生成与交付包.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.workflow-1dcf62c4/"], "packaged_capabilities": ["cap.openclaw.skill.ai-image-generation", "cap.openclaw.skill.assistant-orchestrator", "cap.openclaw.skill.frontend-design", "cap.openclaw.skill.penpot-uiux-design", "cap.openclaw.skill.video-prompting-guide", "cap.openclaw.skill.web-design-guidelines"], "entrypoints": [{"label": "网页落地页生成与交付包", "command": "__OPENCLAW_WORKFLOW__ sop-网页落地页生成与交付包"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/网页落地页生成与交付包.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
