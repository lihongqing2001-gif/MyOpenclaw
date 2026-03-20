import argparse
import json
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


def safe_name(value: str) -> str:
    return "".join(ch.lower() if ch.isalnum() else "-" for ch in value).strip("-")


def normalize_token(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return normalized or "item"


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


def capability_id_for_node(node: dict[str, Any]) -> str:
    node_id = str(node.get("id") or "").strip()
    if node_id.startswith("sop-"):
        node_id = node_id[4:]
    token = normalize_token(node_id or str(node.get("label") or "workflow"))
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
        hints.append(
            {
                "capability_id": capability_id,
                "label": module.get("label"),
                "summary": module.get("summary"),
                "source_type": module.get("sourceType"),
                "source_path": source_path,
                "install_command": module.get("installCommand"),
                "install_url": module.get("installUrl"),
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

    local_paths = collect_local_paths(node)
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

    zip_path = output_root / f"{bundle_dir_name}.zip"
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
