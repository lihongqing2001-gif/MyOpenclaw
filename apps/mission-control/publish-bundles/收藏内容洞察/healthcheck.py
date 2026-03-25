import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.workflow-b3ed9783", "name": "收藏内容洞察", "version": "0.2.0", "description": "针对一条你收藏或转发给系统的短视频链接，生成一份可阅读、可检索、可继续提问的洞察记录，并写入长期资产库与知识库。", "domain": "社交媒体与内容", "category": "内容洞察", "tags": ["社交媒体与内容", "内容洞察", "sop"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": [], "requires": ">=2026.3.2", "skills": ["skills/douyin-video/SKILL.md", "skills/remotion-video-production/SKILL.md", "skills/social-content/SKILL.md", "skills/video-production/SKILL.md", "skills/video-prompting-guide/SKILL.md", "skills/videoagent-video-studio/SKILL.md"], "sops": ["sops/收藏内容洞察.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.workflow-b3ed9783/"], "packaged_capabilities": ["cap.openclaw.skill.douyin-video", "cap.openclaw.skill.remotion-video-production", "cap.openclaw.skill.social-content", "cap.openclaw.skill.video-production", "cap.openclaw.skill.video-prompting-guide", "cap.openclaw.skill.videoagent-video-studio"], "entrypoints": [{"label": "收藏内容洞察", "command": "python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_saved_video_insight_capture.py --video-url <视频链接>"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/收藏内容洞察.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
