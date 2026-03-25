import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.workflow-60e58f7e", "name": "短视频对标账号分析三阶段链路", "version": "0.2.0", "description": "围绕一个真实对标账号，把多条视频先采成 raw 证据层，再并行做单视频 Gemini 深拆，最后汇总成真正可用的账号分析包。", "domain": "社交媒体与内容", "category": "内容洞察", "tags": ["社交媒体与内容", "内容洞察", "sop"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": [], "requires": ">=2026.3.2", "skills": ["skills/baoyu-danger-gemini-web/SKILL.md", "skills/douyin-video/SKILL.md", "skills/remotion-video-production/SKILL.md", "skills/alex-session-wrap-up/SKILL.md", "skills/social-content/SKILL.md", "skills/video-production/SKILL.md", "skills/video-prompting-guide/SKILL.md", "skills/videoagent-video-studio/SKILL.md"], "sops": ["sops/短视频对标账号分析三阶段链路.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.workflow-60e58f7e/"], "packaged_capabilities": ["cap.openclaw.skill.alex-session-wrap-up", "cap.openclaw.skill.baoyu-danger-gemini-web", "cap.openclaw.skill.douyin-video", "cap.openclaw.skill.remotion-video-production", "cap.openclaw.skill.social-content", "cap.openclaw.skill.video-production", "cap.openclaw.skill.video-prompting-guide", "cap.openclaw.skill.videoagent-video-studio"], "entrypoints": [{"label": "短视频对标账号分析三阶段链路", "command": "python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_short_video_account_raw_collect.py --manifest-path <sample_manifest.json>"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/短视频对标账号分析三阶段链路.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
