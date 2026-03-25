import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.workflow-c62a80e1", "name": "博客文章分析与改写方案", "version": "0.2.0", "description": "对一篇博客文章做结构、观点、风格与可传播性分析，并输出改写建议或多平台转化方案。", "domain": "社交媒体与内容", "category": "内容采集", "tags": ["社交媒体与内容", "内容采集", "sop"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": [], "requires": ">=2026.3.2", "skills": ["skills/assistant-orchestrator/SKILL.md", "skills/frontend-design/SKILL.md", "skills/penpot-uiux-design/SKILL.md", "skills/web-design-guidelines/SKILL.md", "skills/web-search-plus/SKILL.md"], "sops": ["sops/博客文章分析与改写方案.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.workflow-c62a80e1/"], "packaged_capabilities": ["cap.openclaw.skill.assistant-orchestrator", "cap.openclaw.skill.frontend-design", "cap.openclaw.skill.penpot-uiux-design", "cap.openclaw.skill.web-design-guidelines", "cap.openclaw.skill.web-search-plus"], "entrypoints": [{"label": "博客文章分析与改写方案", "command": "__OPENCLAW_WORKFLOW__ sop-博客文章分析与改写方案"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/博客文章分析与改写方案.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
