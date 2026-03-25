import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.gemini-21ce414b", "name": "Gemini 多轮视频追问分析", "version": "0.2.0", "description": "针对一个本地视频文件，在同一个 Gemini 会话里先上传视频，再结合 transcript 连续追问多个细化问题，最终形成一份高价值单条视频深拆报告。", "domain": "社交媒体与内容", "category": "内容洞察", "tags": ["社交媒体与内容", "内容洞察", "sop"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": [], "requires": ">=2026.3.2", "skills": ["skills/baoyu-danger-gemini-web/SKILL.md", "skills/douyin-video/SKILL.md", "skills/remotion-video-production/SKILL.md", "skills/alex-session-wrap-up/SKILL.md", "skills/video-production/SKILL.md", "skills/video-prompting-guide/SKILL.md", "skills/videoagent-video-studio/SKILL.md"], "sops": ["sops/gemini-多轮视频追问分析.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.gemini-21ce414b/"], "packaged_capabilities": ["cap.openclaw.skill.alex-session-wrap-up", "cap.openclaw.skill.baoyu-danger-gemini-web", "cap.openclaw.skill.douyin-video", "cap.openclaw.skill.remotion-video-production", "cap.openclaw.skill.video-production", "cap.openclaw.skill.video-prompting-guide", "cap.openclaw.skill.videoagent-video-studio"], "entrypoints": [{"label": "Gemini 多轮视频追问分析", "command": "python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_gemini_video_multiturn_analysis.py --video-path <本地视频路径>"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/gemini-多轮视频追问分析.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
