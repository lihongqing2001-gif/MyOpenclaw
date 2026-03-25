import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.workflow-4fd5a428", "name": "多平台内容改写包", "version": "0.2.0", "description": "把一份已有素材或一篇已有成品，改写成多平台可直接发布的内容包。", "domain": "社交媒体与内容", "category": "内容改写", "tags": ["社交媒体与内容", "内容改写", "sop"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": [], "requires": ">=2026.3.2", "skills": ["skills/social-content/SKILL.md"], "sops": ["sops/多平台内容改写包.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.workflow-4fd5a428/"], "packaged_capabilities": ["cap.openclaw.skill.social-content"], "entrypoints": [{"label": "多平台内容改写包", "command": "__OPENCLAW_WORKFLOW__ sop-小红书内容多平台改写包"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/多平台内容改写包.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
