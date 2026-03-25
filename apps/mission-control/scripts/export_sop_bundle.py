import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASE_URL = "http://127.0.0.1:3000"
COMMUNITY_SCHEMA_PATH = PROJECT_ROOT.parent / "packages" / "community-package-v1" / "manifest.schema.json"
DEFAULT_RESOURCE_OWNER = "openclaw-labs"
RELEASE_SCHEMA_VERSION = "openclaw-resource-release-v1"


def safe_name(value: str) -> str:
    return "".join(ch.lower() if ch.isalnum() else "-" for ch in value).strip("-")


def normalize_token(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return normalized or "item"


def has_non_ascii(value: str) -> bool:
    return any(ord(ch) > 127 for ch in value)


def stable_token_for_source(value: str) -> str:
    token = normalize_token(value)
    if has_non_ascii(value):
        suffix = hashlib.sha1(value.encode("utf-8")).hexdigest()[:8]
        if token == "item":
            return f"workflow-{suffix}"
        return f"{token}-{suffix}"
    return token


def fetch_skill_tree(base_url: str) -> list[dict[str, Any]]:
    try:
        with urllib.request.urlopen(f"{base_url}/api/v1/skill-tree", timeout=3) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return payload["nodes"]
    except Exception:
        process = subprocess.run(
            [
                "node",
                "--import",
                "tsx",
                "-e",
                "import { loadSkillTreeNodes } from './src/server/skillTreeLoader.ts'; console.log(JSON.stringify(loadSkillTreeNodes()));",
            ],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=15,
        )
        if process.returncode != 0:
            raise SystemExit(process.stderr or process.stdout or "Unable to load local skill tree")
        return json.loads(process.stdout)


def decode_doc_path(url: str) -> str | None:
    if "/api/v1/doc?path=" not in url:
        return None
    parsed = urllib.parse.urlparse(url)
    params = urllib.parse.parse_qs(parsed.query)
    return params.get("path", [None])[0]


def collect_local_paths(node: dict[str, Any]) -> list[Path]:
    paths: list[Path] = []
    source_path = node.get("sourcePath")
    if source_path:
        paths.append(Path(source_path))

    drawer = node.get("drawerContent") or {}
    for module in drawer.get("requiredSkills") or []:
        source = module.get("sourcePath")
        if source:
            paths.append(Path(source))

    for doc in (drawer.get("knowledgeBase") or {}).get("documents") or []:
        local = decode_doc_path(doc.get("url", "")) or (
            doc.get("url") if doc.get("url", "").startswith("/") else None
        )
        if local:
            paths.append(Path(local))

    commands = [drawer.get("invoke"), *(drawer.get("commands") or [])]
    for command in commands:
        if not command:
            continue
        for token in command.split():
            if token.startswith("/") and Path(token).exists():
                paths.append(Path(token))

    deduped: list[Path] = []
    seen: set[Path] = set()
    for path in paths:
        resolved = path.expanduser().resolve()
        if resolved.exists() and resolved not in seen:
            deduped.append(resolved)
            seen.add(resolved)
    return deduped


def write_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def sha256_for_path(target: Path) -> str:
    digest = hashlib.sha256()
    with target.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def iso_now() -> str:
    return subprocess.run(
        ["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"],
        capture_output=True,
        text=True,
        check=False,
    ).stdout.strip()


def github_owner() -> str:
    env_value = (os.environ.get("OPENCLAW_RESOURCE_GITHUB_OWNER") or "").strip()
    if env_value:
        return env_value
    process = subprocess.run(
        ["git", "remote", "get-url", "origin"],
        cwd=PROJECT_ROOT.parents[2],
        capture_output=True,
        text=True,
        check=False,
    )
    remote = process.stdout.strip()
    match = re.search(r"github\\.com[:/]+([^/]+)/", remote)
    if match:
        return match.group(1)
    return DEFAULT_RESOURCE_OWNER


def package_repo_name(package_type: str) -> str:
    mapping = {
        "skill-pack": "openclaw-skills",
        "sop-pack": "openclaw-sops",
        "demo-pack": "openclaw-demos",
        "tutorial-pack": "openclaw-tutorials",
        "case-pack": "openclaw-cases",
    }
    return mapping.get(package_type, "openclaw-resources")


def package_homepage(package_type: str, slug: str) -> str:
    owner = github_owner()
    repo = package_repo_name(package_type)
    return f"https://github.com/{owner}/{repo}/tree/main/resources/{slug}"


def skill_source_metadata(source_path: str | None, slug: str) -> dict[str, str]:
    if not source_path:
        return {
            "install_url": "",
            "mirror_status": "upstream-only",
            "repository": "",
            "license": "Unknown",
        }
    skill_dir = Path(source_path).expanduser().resolve().parent
    if str(skill_dir).startswith(str(WORKSPACE_ROOT / "skills")) and not (skill_dir / "_meta.json").exists():
        homepage = package_homepage("skill-pack", slug)
        return {
            "install_url": homepage,
            "mirror_status": "official",
            "repository": f"https://github.com/{github_owner()}/{package_repo_name('skill-pack')}",
            "license": "Proprietary",
        }
    return {
        "install_url": "",
        "mirror_status": "upstream-only",
        "repository": "",
        "license": "Unknown",
    }


def build_release_manifest(
    package_type: str,
    package_id: str,
    name: str,
    version: str,
    slug: str,
    source: dict[str, Any],
    install: dict[str, Any],
) -> dict[str, Any]:
    return {
        "schemaVersion": RELEASE_SCHEMA_VERSION,
        "resourceType": package_type,
        "resourceId": package_id,
        "name": name,
        "version": version,
        "artifactType": "openclaw-resource-bundle",
        "git": git_metadata(PROJECT_ROOT),
        "source": source,
        "license": source.get("license") or "Not specified",
        "install": install,
        "homepage": source.get("homepage") or package_homepage(package_type, slug),
        "archiveFile": f"{slug}-v{version}.zip",
        "builtAt": iso_now(),
    }


def git_metadata(root: Path) -> dict[str, str | bool]:
    def run(*args: str) -> str:
        result = subprocess.run(
            ["git", *args],
            cwd=root,
            capture_output=True,
            text=True,
            check=False,
        )
        return result.stdout.strip()

    return {
        "commit": run("rev-parse", "HEAD"),
        "branch": run("rev-parse", "--abbrev-ref", "HEAD"),
        "tag": run("describe", "--tags", "--exact-match"),
        "repo": run("remote", "get-url", "origin"),
        "dirty": bool(run("status", "--short")),
    }


def build_install_doc(name: str, package_id: str, install: dict[str, Any], source: dict[str, Any]) -> str:
    lines = [
        f"# Install {name}",
        "",
        f"- Package ID: `{package_id}`",
        f"- Install via: `{install.get('via', 'forge-console')}`",
        f"- Source: `{source.get('mirrorStatus', 'official')}`",
    ]
    if source.get("repository"):
        lines.append(f"- Repository: {source['repository']}")
    if source.get("homepage"):
        lines.append(f"- Homepage: {source['homepage']}")
    if source.get("license"):
        lines.append(f"- License: {source['license']}")
    lines.extend(
        [
            "",
            "## Recommended Install Flow",
            "",
            "1. Download the release asset or clone the official resource repository.",
            "2. Open Forge Console.",
            "3. Go to Community Packages and import the package zip.",
            "4. Inspect metadata, permissions, and dependencies before install.",
        ]
    )
    if install.get("command"):
        lines.extend(["", "## Install Command", "", f"```bash\n{install['command']}\n```"])
    if install.get("url"):
        lines.extend(["", "## Source / Install Link", "", install["url"]])
    if install.get("notes"):
        lines.extend(["", "## Notes", ""])
        lines.extend(f"- {note}" for note in install["notes"])
    return "\n".join(lines) + "\n"


def asset_kind_for_path(target: Path) -> str:
    suffix = target.suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}:
        return "image"
    if suffix in {".mp4", ".mov", ".webm", ".m4v"}:
        return "video"
    if suffix in {".py", ".sh", ".js", ".ts"}:
        return "script"
    if suffix in {".md", ".txt"}:
        return "knowledge"
    if suffix in {".zip", ".tar", ".gz"}:
        return "archive"
    return "document"


def infer_permissions(node: dict[str, Any], local_paths: list[Path]) -> list[dict[str, Any]]:
    drawer = node.get("drawerContent") or {}
    commands = [drawer.get("invoke"), *(drawer.get("commands") or [])]
    joined = " ".join(item for item in commands if item)
    permissions: list[dict[str, Any]] = [
        {
            "key": "filesystem.read",
            "required": True,
            "reason": "Read packaged SOP, docs, and supporting local files.",
        }
    ]

    if any(path.suffix.lower() in {".py", ".sh", ".js", ".ts"} for path in local_paths) or "python" in joined or "node " in joined:
        permissions.append(
            {
                "key": "process.exec",
                "required": True,
                "reason": "Run packaged scripts or workflow commands after local user confirmation.",
            }
        )
    if any(token in joined for token in ["write", "edit", "archive", "output", "--output", "qmd update"]):
        permissions.append(
            {
                "key": "filesystem.write",
                "required": True,
                "reason": "Write artifacts, archive outputs, or generated knowledge locally.",
            }
        )
    if "http" in joined or "https" in joined or "search.py" in joined:
        permissions.append(
            {
                "key": "network.http",
                "required": False,
                "reason": "Optional outbound requests may be needed for integrations or remote fetches.",
            }
        )
    if "qmd" in joined:
        permissions.append(
            {
                "key": "knowledge.write",
                "required": False,
                "reason": "Optional indexed knowledge updates may be triggered during local execution.",
            }
        )
    return permissions


def build_community_dependency_entries(dependency_hints: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "id": hint["capability_id"],
            "label": hint.get("label") or hint["capability_id"],
            "kind": hint.get("source_type") or "integration",
            "required": not bool(hint.get("packaged")),
            "installCommand": hint.get("install_command") or "",
            "installUrl": hint.get("install_url") or "",
            "bundled": bool(hint.get("packaged")),
        }
        for hint in dependency_hints
    ]


def build_community_capabilities(node: dict[str, Any], packaged_capabilities: list[str]) -> list[dict[str, Any]]:
    drawer = node.get("drawerContent") or {}
    capabilities = [
        {
            "id": capability_id_for_node(node),
            "label": node["label"],
            "summary": drawer.get("summary", ""),
            "entrypoint": drawer.get("invoke") or f"__OPENCLAW_WORKFLOW__ {node['id']}",
        }
    ]
    for capability_id in packaged_capabilities:
        capabilities.append(
            {
                "id": capability_id,
                "label": capability_id.split(".")[-1],
                "summary": "Bundled supporting capability.",
                "entrypoint": "",
            }
        )
    return capabilities


def collect_bundle_docs_and_assets(bundle_root: Path) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    docs: list[dict[str, str]] = []
    assets: list[dict[str, str]] = []
    for file_path in sorted(path for path in bundle_root.rglob("*") if path.is_file()):
        relative = file_path.relative_to(bundle_root).as_posix()
        if relative in {"community-package.json", "capability-manifest.json", "dependency-hints.json", "install.py", "healthcheck.py"}:
            continue
        if file_path.suffix.lower() == ".md":
            docs.append({"title": file_path.stem, "path": relative})
        assets.append(
            {
                "path": relative,
                "kind": asset_kind_for_path(file_path),
                "label": file_path.name,
            }
        )
    return docs, assets


def collect_file_checksums(bundle_root: Path) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    for file_path in sorted(path for path in bundle_root.rglob("*") if path.is_file()):
        relative = file_path.relative_to(bundle_root).as_posix()
        if relative == "community-package.json":
            continue
        entries.append(
            {
                "path": relative,
                "sha256": sha256_for_path(file_path),
            }
        )
    return entries


def capability_id_for_node(node: dict[str, Any]) -> str:
    node_id = str(node.get("id") or "").strip()
    if node_id.startswith("sop-"):
        node_id = node_id[4:]
    token = stable_token_for_source(node_id or str(node.get("label") or "workflow"))
    return f"cap.openclaw.sop.{token}"


def capability_id_for_module(module: dict[str, Any]) -> str:
    module_id = str(module.get("id") or "").strip()
    label = str(module.get("label") or "module").strip()
    source_type = str(module.get("sourceType") or "skill").strip()
    source_path = str(module.get("sourcePath") or "").strip()

    if module_id.startswith("module-foundation-"):
        return f"cap.openclaw.foundation.{normalize_token(module_id.removeprefix('module-foundation-'))}"
    if module_id.startswith("module-integration-"):
        return f"cap.openclaw.integration.{normalize_token(module_id.removeprefix('module-integration-'))}"
    if module_id.startswith("module-skill-"):
        return f"cap.openclaw.skill.{normalize_token(module_id.removeprefix('module-skill-'))}"

    if source_type == "skill" and source_path.endswith("/SKILL.md"):
        return f"cap.openclaw.skill.{normalize_token(Path(source_path).parent.name)}"
    if source_type == "foundation":
        return f"cap.openclaw.foundation.{normalize_token(module_id or label)}"
    if source_type == "integration":
        return f"cap.openclaw.integration.{normalize_token(module_id or label)}"
    if source_type == "sop":
        return f"cap.openclaw.sop.{normalize_token(module_id or label)}"
    return f"cap.openclaw.skill.{normalize_token(module_id or label)}"


def build_generated_sop_markdown(
    node: dict[str, Any],
    domain: str,
    area: str,
    manifest_id: str,
    dependency_hints: list[dict[str, Any]],
) -> str:
    drawer = node.get("drawerContent") or {}
    lines = [
        f"# SOP: {node['label']}",
        "",
        f"- Capability ID: {manifest_id}",
        f"- Node ID: {node['id']}",
        f"- Domain: {domain}",
        f"- Area: {area}",
    ]
    if drawer.get("summary"):
        lines.extend(["", "## Summary", drawer["summary"]])
    if drawer.get("prerequisites"):
        lines.extend(["", "## Preconditions", drawer["prerequisites"]])
    if drawer.get("inputs"):
        lines.extend(["", "## Inputs"])
        for item in drawer["inputs"]:
            required = "required" if item.get("required") else "optional"
            lines.append(f"- {item['field']} ({required})")
    if drawer.get("commands"):
        lines.extend(["", "## Commands"])
        for command in drawer["commands"]:
            lines.append(f"- `{command}`")
    if dependency_hints:
        lines.extend(["", "## Required Capabilities"])
        for hint in dependency_hints:
            packaged = "bundled" if hint["packaged"] else "external"
            lines.append(f"- `{hint['capability_id']}` · {hint['label']} · {packaged}")
    if drawer.get("useCases"):
        lines.extend(["", "## Use Cases"])
        for use_case in drawer["useCases"]:
            lines.append(f"- {use_case['title']}: {use_case['summary']}")
    return "\n".join(lines) + "\n"


def build_readme(
    node: dict[str, Any],
    domain: str,
    area: str,
    manifest: dict[str, Any],
    dependency_hints: list[dict[str, Any]],
) -> str:
    drawer = node.get("drawerContent") or {}
    packaged = [hint for hint in dependency_hints if hint["packaged"]]
    external = [hint for hint in dependency_hints if not hint["packaged"]]
    commands = drawer.get("commands") or []

    packaged_text = (
        "\n".join(
            f"- `{hint['capability_id']}` · {hint['label']}"
            for hint in packaged
        )
        or "- None"
    )
    external_lines: list[str] = []
    for hint in external:
        external_lines.append(f"- `{hint['capability_id']}` · {hint['label']}")
        if hint.get("install_command"):
            external_lines.append(f"  install: `{hint['install_command']}`")
        if hint.get("install_url"):
            external_lines.append(f"  docs: {hint['install_url']}")
    external_text = "\n".join(external_lines) or "- None"

    return f"""# {node['label']}

## Overview

- Capability ID: `{manifest['id']}`
- Node ID: `{node['id']}`
- Domain: {domain}
- Area: {area}
- Source: {node.get('sourcePath', 'generated')}

## Summary

{drawer.get('summary', 'No summary available.')}

## Inputs

{chr(10).join(f"- {item['field']}" for item in drawer.get('inputs', [])) or '- None'}

## Bundled Capabilities

{packaged_text}

## External Dependencies

{external_text}

## Commands

{chr(10).join(f"- `{item}`" for item in commands) or '- Workflow-driven execution'}

## Install On Another OpenClaw

1. Unzip the package.
2. Run `python3 install.py`.
3. If the installer reports missing dependencies, install them one by one according to the list.
4. Run `python3 healthcheck.py`.
5. Start your resident OpenClaw agent and execute the packaged SOP from the new workspace.
"""


def build_openclaw_md(
    node: dict[str, Any],
    manifest: dict[str, Any],
    dependency_hints: list[dict[str, Any]],
) -> str:
    packaged = [hint for hint in dependency_hints if hint["packaged"]]
    external = [hint for hint in dependency_hints if not hint["packaged"]]
    return f"""# OpenClaw Bundle Instructions

This package contains the SOP `{node['label']}` as capability `{manifest['id']}`.

## Required Behavior

- Install with `python3 install.py`
- Validate with `python3 healthcheck.py`
- Refuse silent execution if external dependencies are missing
- Report missing permissions or missing capabilities to the user one by one

## Bundled Capabilities

{chr(10).join(f"- `{hint['capability_id']}` · {hint['label']}" for hint in packaged) or '- None'}

## External Dependencies

{chr(10).join(f"- `{hint['capability_id']}` · {hint['label']}" for hint in external) or '- None'}

## Execution Contract

- Use `sops/` as the human-readable workflow source
- Use `scripts/` when available
- Read `dependency-hints.json` before asking for missing installs
- Write outputs under `outputs/<capability>/<sop>/<timestamp>/` when the runtime supports it
"""


def build_dependency_hints(node: dict[str, Any]) -> list[dict[str, Any]]:
    hints: list[dict[str, Any]] = []
    seen: set[str] = set()

    drawer = node.get("drawerContent") or {}
    for module in drawer.get("requiredSkills") or []:
        capability_id = capability_id_for_module(module)
        if capability_id in seen:
            continue
        seen.add(capability_id)
        source_path = module.get("sourcePath")
        packaged = bool(source_path and Path(source_path).expanduser().exists() and str(source_path).endswith("/SKILL.md"))
        source_meta = skill_source_metadata(source_path, normalize_token(Path(source_path).parent.name) if source_path else normalize_token(module.get("label") or capability_id))
        hints.append(
            {
                "capability_id": capability_id,
                "label": module.get("label"),
                "summary": module.get("summary"),
                "source_type": module.get("sourceType"),
                "source_path": source_path,
                "install_command": module.get("installCommand"),
                "install_url": module.get("installUrl") or source_meta["install_url"],
                "source_repository": source_meta["repository"],
                "mirror_status": source_meta["mirror_status"],
                "license": source_meta["license"],
                "installed": bool(module.get("installed")),
                "evidence": module.get("evidence"),
                "packaged": packaged,
            }
        )

    return hints


def build_install_py(manifest: dict[str, Any]) -> str:
    manifest_blob = json.dumps(manifest, ensure_ascii=False)
    return f"""import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
import re


MANIFEST = json.loads(r'''{manifest_blob}''')


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
                installed.add(f"cap.openclaw.skill.{{normalize_token(skill_dir.name)}}")

    content_tree = workspace / "content_system" / "skilltree" / "data.json"
    payload = load_json(content_tree, {{}})
    for node in payload.get("nodes", []):
        if node.get("nodeType") == "foundation":
            node_id = str(node.get("id") or node.get("title") or "foundation")
            token = node_id.removeprefix("foundation-")
            installed.add(f"cap.openclaw.foundation.{{normalize_token(token)}}")

    return installed


def dependency_hints_by_id(bundle_root: Path) -> dict[str, dict]:
    hints = load_json(bundle_root / "dependency-hints.json", [])
    return {{item["capability_id"]: item for item in hints if item.get("capability_id")}}


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
            hint = hints.get(capability_id, {{}})
            print(f"- {{capability_id}} :: {{hint.get('label', 'Unknown capability')}}")
            if hint.get("install_command"):
                print(f"  install: {{hint['install_command']}}")
            if hint.get("install_url"):
                print(f"  docs: {{hint['install_url']}}")
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
        {{
            "id": MANIFEST["id"],
            "version": MANIFEST["version"],
            "installed_at": datetime.now(timezone.utc).isoformat(),
            "checksum": "",
            "status": "installed",
        }}
    )
    record_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Installed {{MANIFEST['id']}}")


if __name__ == "__main__":
    main()
"""


def build_healthcheck_py(manifest: dict[str, Any], sop_relative_path: str) -> str:
    manifest_blob = json.dumps(manifest, ensure_ascii=False)
    return f"""import json
from pathlib import Path


MANIFEST = json.loads(r'''{manifest_blob}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "{sop_relative_path}",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {{MANIFEST['id']}}")


if __name__ == "__main__":
    main()
"""


def export_bundle_from_nodes(
    nodes: list[dict[str, Any]],
    node_id: str,
    output_root: Path,
) -> dict[str, Any]:
    node_by_id = {node["id"]: node for node in nodes}
    if node_id not in node_by_id:
        raise SystemExit(f"Unknown node id: {node_id}")

    node = node_by_id[node_id]
    if node["level"] != 3:
        raise SystemExit("Only level-3 SOP/workflow nodes can be exported")

    area = node_by_id[node["parentId"]]
    domain = node_by_id[area["parentId"]]
    display_name = node["label"]
    bundle_dir_name = safe_name(display_name) or safe_name(node["id"]) or "bundle"
    bundle_root = output_root / bundle_dir_name
    if bundle_root.exists():
        shutil.rmtree(bundle_root)
    bundle_root.mkdir(parents=True, exist_ok=True)

    dependency_hints = build_dependency_hints(node)
    packaged_capabilities = sorted(
        hint["capability_id"] for hint in dependency_hints if hint["packaged"]
    )
    external_dependencies = sorted(
        hint["capability_id"] for hint in dependency_hints if not hint["packaged"]
    )
    local_paths = collect_local_paths(node)
    manifest = {
        "id": capability_id_for_node(node),
        "name": node["label"],
        "version": "0.2.0",
        "description": (node.get("drawerContent") or {}).get("summary", ""),
        "domain": domain["label"],
        "category": area["label"],
        "tags": ((node.get("drawerContent") or {}).get("knowledgeBase") or {}).get("tags", []),
        "ownership": "openclaw",
        "publish": "local-bundle",
        "dependencies": external_dependencies,
        "requires": ">=2026.3.2",
        "skills": [],
        "sops": [f"sops/{bundle_dir_name}.md"],
        "install": "python3 install.py",
        "healthcheck": "python3 healthcheck.py",
        "outputs": [f"outputs/{capability_id_for_node(node)}/"],
        "packaged_capabilities": packaged_capabilities,
        "entrypoints": [
            {
                "label": node["label"],
                "command": ((node.get("drawerContent") or {}).get("invoke") or f"__OPENCLAW_WORKFLOW__ {node['id']}"),
            }
        ],
    }

    for local_path in local_paths:
        if local_path.name == "SKILL.md":
            skill_dir = local_path.parent
            target = bundle_root / "skills" / skill_dir.name
            shutil.copytree(skill_dir, target, dirs_exist_ok=True)
            skill_rel_path = str(Path("skills") / skill_dir.name / "SKILL.md")
            if skill_rel_path not in manifest["skills"]:
                manifest["skills"].append(skill_rel_path)
        elif local_path.suffix == ".md":
            target = bundle_root / "knowledge" / local_path.name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(local_path, target)
        elif local_path.suffix in {".py", ".sh"}:
            target = bundle_root / "scripts" / local_path.name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(local_path, target)

    sop_md = build_generated_sop_markdown(
        node,
        domain["label"],
        area["label"],
        manifest["id"],
        dependency_hints,
    )
    sop_relative_path = f"sops/{bundle_dir_name}.md"
    write_file(bundle_root / sop_relative_path, sop_md)
    write_file(
        bundle_root / "README.md",
        build_readme(node, domain["label"], area["label"], manifest, dependency_hints),
    )
    write_file(
        bundle_root / "OPENCLAW.md",
        build_openclaw_md(node, manifest, dependency_hints),
    )
    write_file(bundle_root / "install.py", build_install_py(manifest))
    write_file(
        bundle_root / "healthcheck.py",
        build_healthcheck_py(manifest, sop_relative_path),
    )
    write_file(
        bundle_root / "capability-manifest.json",
        json.dumps(manifest, ensure_ascii=False, indent=2),
    )
    write_file(
        bundle_root / "dependency-hints.json",
        json.dumps(dependency_hints, ensure_ascii=False, indent=2),
    )
    if COMMUNITY_SCHEMA_PATH.exists():
        target_schema_dir = bundle_root / "schemas"
        target_schema_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(COMMUNITY_SCHEMA_PATH, target_schema_dir / "community-package-v1.schema.json")

    bundle_slug = safe_name(bundle_dir_name) or safe_name(manifest["id"]) or "resource"
    owner = github_owner()
    repository = f"https://github.com/{owner}/{package_repo_name('sop-pack')}"
    install_doc = {
        "via": "forge-console",
        "command": f"Import `{bundle_slug}-v{manifest['version']}.zip` in Forge Console, then install `{manifest['id']}` locally.",
        "url": package_homepage("sop-pack", bundle_slug),
        "notes": [
            "This package is intended for Forge Console local installation.",
            "External dependencies remain visible in the dependency list and should be installed before enablement.",
        ],
    }
    release_manifest = build_release_manifest(
        "sop-pack",
        manifest["id"],
        manifest["name"],
        manifest["version"],
        bundle_slug,
        {
            "kind": "local-export",
            "repository": repository,
            "homepage": package_homepage("sop-pack", bundle_slug),
            "license": "Proprietary",
            "mirrorStatus": "official",
            "createdAt": iso_now(),
        },
        install_doc,
    )

    write_file(bundle_root / "install.md", build_install_doc(manifest["name"], manifest["id"], install_doc, release_manifest["source"]))
    write_file(bundle_root / "release-manifest.json", json.dumps(release_manifest, ensure_ascii=False, indent=2))

    docs, assets = collect_bundle_docs_and_assets(bundle_root)
    community_package = {
        "schemaVersion": "community-package-v1",
        "packageId": manifest["id"],
        "type": "sop-pack",
        "name": manifest["name"],
        "version": manifest["version"],
        "author": {
            "name": "OpenClaw",
            "id": "official/openclaw",
        },
        "description": manifest.get("description") or f"Portable SOP package for {manifest['name']}.",
        "source": {
            "kind": "local-export",
            "repository": repository,
            "homepage": package_homepage("sop-pack", bundle_slug),
            "license": "Proprietary",
            "mirrorStatus": "official",
            "createdAt": iso_now(),
        },
        "install": install_doc,
        "capabilities": build_community_capabilities(node, packaged_capabilities),
        "dependencies": build_community_dependency_entries(dependency_hints),
        "compatibility": {
            "openclawMinVersion": manifest["requires"].removeprefix(">="),
            "installMode": "local-console",
            "platforms": ["macos", "linux", "windows"],
        },
        "permissions": infer_permissions(node, local_paths),
        "checksums": {
            "algorithm": "sha256",
            "files": collect_file_checksums(bundle_root),
        },
        "docs": docs,
        "assets": assets,
        "reviewStatus": "draft",
        "visibility": "private",
    }
    write_file(
        bundle_root / "community-package.json",
        json.dumps(community_package, ensure_ascii=False, indent=2),
    )

    zip_path = output_root / release_manifest["archiveFile"]
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in bundle_root.rglob("*"):
            if path.is_file():
                zf.write(path, path.relative_to(output_root))

    return {
        "nodeId": node["id"],
        "nodeLabel": node["label"],
        "capabilityId": manifest["id"],
        "bundleDir": str(bundle_root),
        "zipPath": str(zip_path),
        "relativeZipPath": str(zip_path.relative_to(PROJECT_ROOT)),
        "downloadUrl": "/" + zip_path.relative_to(PROJECT_ROOT).as_posix(),
        "dependencies": manifest["dependencies"],
        "packagedCapabilities": manifest["packaged_capabilities"],
    }


def write_bundle_index(output_root: Path, bundles: list[dict[str, Any]]) -> Path:
    index_payload = {
        "generatedAt": subprocess.run(
            ["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"],
            capture_output=True,
            text=True,
            check=False,
        ).stdout.strip(),
        "count": len(bundles),
        "bundles": bundles,
    }
    index_path = output_root / "index.json"
    write_file(index_path, json.dumps(index_payload, ensure_ascii=False, indent=2))
    return index_path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--node-id")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument(
        "--output-dir",
        default=str(PROJECT_ROOT / "exports" / "bundles"),
    )
    args = parser.parse_args()

    if not args.node_id and not args.all:
        raise SystemExit("Provide --node-id or use --all")

    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    nodes = fetch_skill_tree(args.base_url)

    if args.all:
        bundles = [
            export_bundle_from_nodes(nodes, node["id"], output_dir)
            for node in nodes
            if node.get("level") == 3
        ]
        index_path = write_bundle_index(output_dir, bundles)
        if args.json:
            print(json.dumps({"indexPath": str(index_path), "bundles": bundles}, ensure_ascii=False))
        else:
            print(index_path)
        return 0

    bundle = export_bundle_from_nodes(nodes, args.node_id, output_dir)
    if args.json:
        print(json.dumps(bundle, ensure_ascii=False))
    else:
        print(bundle["zipPath"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
