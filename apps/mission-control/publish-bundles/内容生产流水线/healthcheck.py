import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.content-content-pipeline", "name": "内容生产流水线", "version": "0.2.0", "description": "日更内容、选题实验、风格迭代", "domain": "社交媒体与内容", "category": "发布与复盘", "tags": ["社交媒体与内容", "内容洞察", "核心", "main"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": ["cap.openclaw.foundation.cron-jobs", "cap.openclaw.foundation.files-repo", "cap.openclaw.foundation.messaging"], "requires": ">=2026.3.2", "skills": ["skills/social-content/SKILL.md"], "sops": ["sops/内容生产流水线.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.content-content-pipeline/"], "packaged_capabilities": ["cap.openclaw.skill.social-content"], "entrypoints": [{"label": "内容生产流水线", "command": "__OPENCLAW_WORKFLOW__ sop-content-content-pipeline"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/内容生产流水线.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
