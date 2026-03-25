import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
import re


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.workflow-8e7d89ea", "name": "平台热点选题雷达", "version": "0.2.0", "description": "围绕一个主题或账号方向，持续发现抖音近期值得跟进的热点话题，并输出可直接进入内容排期的选题池。 / 围绕一个明确主题或品类，拉取并汇总小红书与外部信号中的热点选题，输出一份可以直接进入内容排期的选题雷达。。已融合 2 个同类 SOP：抖音热点雷达与选题池、小红书选题雷达与热点跟踪", "domain": "社交媒体与内容", "category": "内容洞察", "tags": ["社交媒体与内容", "内容采集", "sop", "内容洞察", "平台热点选题雷达"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": ["cap.openclaw.integration.skill"], "requires": ">=2026.3.2", "skills": ["skills/assistant-orchestrator/SKILL.md", "skills/social-content/SKILL.md", "skills/web-search-plus/SKILL.md", "skills/xiaohongshu-skills/SKILL.md"], "sops": ["sops/平台热点选题雷达.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.workflow-8e7d89ea/"], "packaged_capabilities": ["cap.openclaw.skill.assistant-orchestrator", "cap.openclaw.skill.social-content", "cap.openclaw.skill.web-search-plus", "cap.openclaw.skill.xiaohongshu-skills"], "entrypoints": [{"label": "平台热点选题雷达", "command": "__OPENCLAW_WORKFLOW__ sop-抖音热点雷达与选题池"}]}''')


def normalize_token(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return normalized or "item"


def copytree(src: Path, dst: Path):
    if src.is_dir():
        shutil.copytree(src, dst, dirs_exist_ok=True)
    else:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def detect_installed_capabilities(workspace: Path) -> set[str]:
    installed = set()
    record_path = Path.home() / ".openclaw" / "capabilities" / "installed.json"
    for item in load_json(record_path, []):
        capability_id = item.get("id")
        if capability_id:
            installed.add(capability_id)

    skills_root = workspace / "skills"
    if skills_root.exists():
        for skill_dir in skills_root.iterdir():
            if (skill_dir / "SKILL.md").exists():
                installed.add(f"cap.openclaw.skill.{normalize_token(skill_dir.name)}")

    content_tree = workspace / "content_system" / "skilltree" / "data.json"
    payload = load_json(content_tree, {})
    for node in payload.get("nodes", []):
        if node.get("nodeType") == "foundation":
            node_id = str(node.get("id") or node.get("title") or "foundation")
            token = node_id.removeprefix("foundation-")
            installed.add(f"cap.openclaw.foundation.{normalize_token(token)}")

    return installed


def dependency_hints_by_id(bundle_root: Path) -> dict[str, dict]:
    hints = load_json(bundle_root / "dependency-hints.json", [])
    return {item["capability_id"]: item for item in hints if item.get("capability_id")}


def main():
    bundle_root = Path(__file__).resolve().parent
    workspace = Path.home() / ".openclaw" / "workspace"
    (workspace / "skills").mkdir(parents=True, exist_ok=True)
    (workspace / "sops").mkdir(parents=True, exist_ok=True)
    (workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"]).mkdir(parents=True, exist_ok=True)
    (workspace / "portable-bundles" / MANIFEST["id"] / "scripts").mkdir(parents=True, exist_ok=True)
    (workspace / "portable-bundles" / MANIFEST["id"] / "bundle").mkdir(parents=True, exist_ok=True)

    installed = detect_installed_capabilities(workspace)
    bundled = set(MANIFEST.get("packaged_capabilities", []))
    hints = dependency_hints_by_id(bundle_root)
    missing = [
        capability_id
        for capability_id in MANIFEST.get("dependencies", [])
        if capability_id not in installed and capability_id not in bundled
    ]

    if missing:
        print("Missing dependencies:")
        for capability_id in missing:
            hint = hints.get(capability_id, {})
            print(f"- {capability_id} :: {hint.get('label', 'Unknown capability')}")
            if hint.get("install_command"):
                print(f"  install: {hint['install_command']}")
            if hint.get("install_url"):
                print(f"  docs: {hint['install_url']}")
        raise SystemExit(1)

    if (bundle_root / "skills").exists():
        for item in (bundle_root / "skills").iterdir():
            copytree(item, workspace / "skills" / item.name)

    if (bundle_root / "sops").exists():
        for item in (bundle_root / "sops").iterdir():
            copytree(item, workspace / "sops" / item.name)

    if (bundle_root / "knowledge").exists():
        for item in (bundle_root / "knowledge").iterdir():
            copytree(item, workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"] / item.name)

    if (bundle_root / "scripts").exists():
        for item in (bundle_root / "scripts").iterdir():
            copytree(item, workspace / "portable-bundles" / MANIFEST["id"] / "scripts" / item.name)

    for item_name in ["README.md", "OPENCLAW.md", "capability-manifest.json", "dependency-hints.json"]:
        copytree(bundle_root / item_name, workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / item_name)

    record_path = Path.home() / ".openclaw" / "capabilities" / "installed.json"
    record_path.parent.mkdir(parents=True, exist_ok=True)
    records = load_json(record_path, [])
    records = [record for record in records if record.get("id") != MANIFEST["id"]]
    records.append(
        {
            "id": MANIFEST["id"],
            "version": MANIFEST["version"],
            "installed_at": datetime.now(timezone.utc).isoformat(),
            "checksum": "",
            "status": "installed",
        }
    )
    record_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Installed {MANIFEST['id']}")


if __name__ == "__main__":
    main()
