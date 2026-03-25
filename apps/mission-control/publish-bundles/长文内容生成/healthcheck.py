import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.content-content-writer", "name": "长文内容生成", "version": "0.2.0", "description": "AI/创业/教育/生活方式等多领域内容产出", "domain": "社交媒体与内容", "category": "内容生产", "tags": ["社交媒体与内容", "内容洞察", "核心", "main"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": ["cap.openclaw.foundation.browser-ops", "cap.openclaw.foundation.knowledge-index", "cap.openclaw.foundation.web-search"], "requires": ">=2026.3.2", "skills": [], "sops": ["sops/长文内容生成.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.content-content-writer/"], "packaged_capabilities": [], "entrypoints": [{"label": "长文内容生成", "command": "/content run --style xiaogai --count 1"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/长文内容生成.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
