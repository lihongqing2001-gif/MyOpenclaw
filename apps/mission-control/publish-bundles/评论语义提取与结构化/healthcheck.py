import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.xiaohongshu-comment-semantic-extraction-auto-excel", "name": "评论语义提取与结构化", "version": "0.2.0", "description": "For a given Xiaohongshu note link, fetch the full comment area, normalize comment semantics into a single business-ready Excel, and default to this SOP whenever the user asks to crawl a Xiaohongshu link's comments.", "domain": "社交媒体与内容", "category": "内容采集", "tags": ["社交媒体与内容", "内容采集", "sop"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": [], "requires": ">=2026.3.2", "skills": ["skills/journal-revision-workflow/SKILL.md", "skills/self-improving/SKILL.md", "skills/alex-session-wrap-up/SKILL.md", "skills/social-content/SKILL.md", "skills/xiaohongshu-skills/SKILL.md"], "sops": ["sops/评论语义提取与结构化.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.xiaohongshu-comment-semantic-extraction-auto-excel/"], "packaged_capabilities": ["cap.openclaw.skill.alex-session-wrap-up", "cap.openclaw.skill.journal-revision-workflow", "cap.openclaw.skill.self-improving", "cap.openclaw.skill.social-content", "cap.openclaw.skill.xiaohongshu-skills"], "entrypoints": [{"label": "评论语义提取与结构化", "command": "python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_xhs_comment_semantic_extract.py --note-url <Xiaohongshu note URL> --output <Output path (optional)> --batch-size <Batch size (optional)>"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/评论语义提取与结构化.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
