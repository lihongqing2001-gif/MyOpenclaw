import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.workflow-7d8ef248", "name": "短视频脚本与分镜交付", "version": "0.2.0", "description": "围绕一个主题或已有文案，输出一套短视频可执行交付包。", "domain": "社交媒体与内容", "category": "内容生产", "tags": ["社交媒体与内容", "内容生产", "sop"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": [], "requires": ">=2026.3.2", "skills": ["skills/ai-image-generation/SKILL.md", "skills/assistant-orchestrator/SKILL.md", "skills/remotion-best-practices/SKILL.md", "skills/remotion-video-production/SKILL.md", "skills/vercel-react-best-practices/SKILL.md"], "sops": ["sops/短视频脚本与分镜交付.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.workflow-7d8ef248/"], "packaged_capabilities": ["cap.openclaw.skill.ai-image-generation", "cap.openclaw.skill.assistant-orchestrator", "cap.openclaw.skill.remotion-best-practices", "cap.openclaw.skill.remotion-video-production", "cap.openclaw.skill.vercel-react-best-practices"], "entrypoints": [{"label": "短视频脚本与分镜交付", "command": "__OPENCLAW_WORKFLOW__ sop-短视频脚本与分镜交付包"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/短视频脚本与分镜交付.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
