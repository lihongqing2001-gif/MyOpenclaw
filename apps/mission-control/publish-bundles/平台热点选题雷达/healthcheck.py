import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.workflow-8e7d89ea", "name": "平台热点选题雷达", "version": "0.2.0", "description": "围绕一个主题或账号方向，持续发现抖音近期值得跟进的热点话题，并输出可直接进入内容排期的选题池。 / 围绕一个明确主题或品类，拉取并汇总小红书与外部信号中的热点选题，输出一份可以直接进入内容排期的选题雷达。。已融合 2 个同类 SOP：抖音热点雷达与选题池、小红书选题雷达与热点跟踪", "domain": "社交媒体与内容", "category": "内容洞察", "tags": ["社交媒体与内容", "内容采集", "sop", "内容洞察", "平台热点选题雷达"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": ["cap.openclaw.integration.skill"], "requires": ">=2026.3.2", "skills": ["skills/assistant-orchestrator/SKILL.md", "skills/social-content/SKILL.md", "skills/web-search-plus/SKILL.md", "skills/xiaohongshu-skills/SKILL.md"], "sops": ["sops/平台热点选题雷达.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.workflow-8e7d89ea/"], "packaged_capabilities": ["cap.openclaw.skill.assistant-orchestrator", "cap.openclaw.skill.social-content", "cap.openclaw.skill.web-search-plus", "cap.openclaw.skill.xiaohongshu-skills"], "entrypoints": [{"label": "平台热点选题雷达", "command": "__OPENCLAW_WORKFLOW__ sop-抖音热点雷达与选题池"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/平台热点选题雷达.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
