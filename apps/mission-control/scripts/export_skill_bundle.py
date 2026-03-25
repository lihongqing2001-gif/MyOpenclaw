#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import zipfile
from pathlib import Path
from typing import Any


WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
PROJECT_ROOT = Path(__file__).resolve().parents[1]
SKILLS_ROOT = WORKSPACE_ROOT / "skills"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "exports" / "resource-bundles" / "skills"
DEFAULT_RESOURCE_OWNER = "openclaw-labs"
RELEASE_SCHEMA_VERSION = "openclaw-resource-release-v1"


def normalize_token(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "item"


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
    gh_login = subprocess.run(
        ["gh", "api", "user", "-q", ".login"],
        capture_output=True,
        text=True,
        check=False,
    ).stdout.strip()
    if gh_login:
        return gh_login
    process = subprocess.run(
        ["git", "remote", "get-url", "origin"],
        cwd=WORKSPACE_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    remote = process.stdout.strip()
    match = re.search(r"github\\.com[:/]+([^/]+)/", remote)
    if match:
        return match.group(1)
    return DEFAULT_RESOURCE_OWNER


def read_skill_frontmatter(skill_md: Path) -> tuple[str, str]:
    content = skill_md.read_text(encoding="utf-8")
    name_match = re.search(r"^name:\s*(.+)$", content, re.MULTILINE)
    description_match = re.search(r"^description:\s*(.+)$", content, re.MULTILINE)
    name = name_match.group(1).strip().strip('"') if name_match else skill_md.parent.name
    description = description_match.group(1).strip().strip('"') if description_match else f"Skill package for {name}"
    return name, description


def is_official_skill(skill_dir: Path) -> bool:
    return not (skill_dir / "_meta.json").exists()


def bundle_slug(skill_dir: Path) -> str:
    return normalize_token(skill_dir.name)


def package_id(skill_dir: Path) -> str:
    return f"cap.openclaw.skill.{bundle_slug(skill_dir)}"


def release_manifest(skill_dir: Path, name: str, version: str) -> dict[str, Any]:
    slug = bundle_slug(skill_dir)
    owner = github_owner()
    mirror_status = "official" if is_official_skill(skill_dir) else "upstream-only"
    repo = f"https://github.com/{owner}/openclaw-skills"
    homepage = f"{repo}/tree/main/resources/{slug}"
    return {
        "schemaVersion": RELEASE_SCHEMA_VERSION,
        "resourceType": "skill-pack",
        "resourceId": package_id(skill_dir),
        "name": name,
        "version": version,
        "artifactType": "openclaw-resource-bundle",
        "git": git_metadata(skill_dir),
        "source": {
            "repository": repo if mirror_status == "official" else "",
            "homepage": homepage if mirror_status == "official" else "",
            "license": "Proprietary" if mirror_status == "official" else "Unknown",
            "mirrorStatus": mirror_status,
            "upstreamRepository": "",
            "upstreamVersion": "",
        },
        "license": "Proprietary" if mirror_status == "official" else "Unknown",
        "install": {
            "via": "forge-console",
            "command": f"Import the skill pack zip in Forge Console, then install `{package_id(skill_dir)}`.",
            "url": homepage if mirror_status == "official" else "",
            "notes": [
                "Skill packs install into the local skills workspace.",
                "Review bundled files before enabling in Forge Console.",
            ],
        },
        "homepage": homepage,
        "archiveFile": f"{slug}-v{version}.zip",
        "builtAt": iso_now(),
    }


def git_metadata(target: Path) -> dict[str, str | bool]:
    def run(*args: str) -> str:
        result = subprocess.run(
            ["git", *args],
            cwd=target,
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


def build_install_py(skill_dir: Path, manifest: dict[str, Any]) -> str:
    skill_name = skill_dir.name
    package_blob = json.dumps(
        {
            "id": package_id(skill_dir),
            "version": manifest["version"],
            "skillDir": skill_name,
        },
        ensure_ascii=False,
    )
    return f"""import json
import shutil
from pathlib import Path

PACKAGE = json.loads(r'''{package_blob}''')

def main():
    bundle_root = Path(__file__).resolve().parent
    workspace = Path.home() / ".openclaw" / "workspace"
    target = workspace / "skills" / PACKAGE["skillDir"]
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(bundle_root / "skills" / PACKAGE["skillDir"], target)
    print(f"Installed {{PACKAGE['id']}} -> {{target}}")

if __name__ == "__main__":
    main()
"""


def build_healthcheck_py(skill_dir: Path) -> str:
    return f"""from pathlib import Path

def main():
    target = Path.home() / ".openclaw" / "workspace" / "skills" / "{skill_dir.name}" / "SKILL.md"
    if not target.exists():
        raise SystemExit(f"Missing installed skill: {{target}}")
    print("Healthcheck OK")

if __name__ == "__main__":
    main()
"""


def build_readme(name: str, description: str, release: dict[str, Any]) -> str:
    return f"""# {name}

## Overview

{description}

## Install

1. Download the skill pack zip from Forge Hub or GitHub Releases.
2. Open Forge Console.
3. Import the zip in Community Packages.
4. Inspect metadata and install locally.

## Source

- Mirror Status: `{release['source']['mirrorStatus']}`
- Homepage: {release['homepage']}
- License: {release['license']}
"""


def build_openclaw_md(name: str, release: dict[str, Any]) -> str:
    return f"""# OpenClaw Skill Instructions

This package installs the skill `{name}` as `{release['resourceId']}`.

## Install Command

`{release['install']['command']}`

## Notes

- Review skill files before enabling.
- Use Forge Console as the installation surface.
"""


def collect_docs_and_assets(bundle_root: Path) -> tuple[list[dict[str, str]], list[dict[str, str]], list[dict[str, str]]]:
    docs: list[dict[str, str]] = []
    assets: list[dict[str, str]] = []
    checksums: list[dict[str, str]] = []
    for file_path in sorted(path for path in bundle_root.rglob("*") if path.is_file()):
        relative = file_path.relative_to(bundle_root).as_posix()
        if file_path.name == "community-package.json":
            continue
        if file_path.suffix.lower() == ".md":
            docs.append({"title": file_path.stem, "path": relative})
        assets.append(
            {
                "path": relative,
                "kind": "knowledge" if file_path.suffix.lower() == ".md" else "document",
                "label": file_path.name,
            }
        )
        digest = hashlib.sha256()
        with file_path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        checksums.append({"path": relative, "sha256": digest.hexdigest()})
    return docs, assets, checksums


def export_skill(skill_dir: Path, output_root: Path) -> dict[str, Any]:
    name, description = read_skill_frontmatter(skill_dir / "SKILL.md")
    version = "0.1.0"
    slug = bundle_slug(skill_dir)
    bundle_root = output_root / slug
    if bundle_root.exists():
        shutil.rmtree(bundle_root)
    bundle_root.mkdir(parents=True, exist_ok=True)

    shutil.copytree(
        skill_dir,
        bundle_root / "skills" / skill_dir.name,
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns(".git", ".venv", "__pycache__", "*.pyc", ".DS_Store"),
    )
    release = release_manifest(skill_dir, name, version)

    (bundle_root / "README.md").write_text(build_readme(name, description, release), encoding="utf-8")
    (bundle_root / "OPENCLAW.md").write_text(build_openclaw_md(name, release), encoding="utf-8")
    (bundle_root / "install.md").write_text(build_readme(name, description, release), encoding="utf-8")
    (bundle_root / "install.py").write_text(build_install_py(skill_dir, release), encoding="utf-8")
    (bundle_root / "healthcheck.py").write_text(build_healthcheck_py(skill_dir), encoding="utf-8")
    (bundle_root / "release-manifest.json").write_text(json.dumps(release, ensure_ascii=False, indent=2), encoding="utf-8")

    docs, assets, checksums = collect_docs_and_assets(bundle_root)
    community = {
        "schemaVersion": "community-package-v1",
        "packageId": package_id(skill_dir),
        "type": "skill-pack",
        "name": name,
        "version": version,
        "author": {
            "name": "OpenClaw",
            "id": "official/openclaw",
            "homepage": release["homepage"],
        },
        "description": description,
        "source": {
            "kind": "official" if is_official_skill(skill_dir) else "community",
            "repository": release["source"]["repository"],
            "homepage": release["homepage"],
            "license": release["license"],
            "mirrorStatus": release["source"]["mirrorStatus"],
            "upstreamRepository": release["source"]["upstreamRepository"],
            "upstreamVersion": release["source"]["upstreamVersion"],
            "createdAt": release["builtAt"],
        },
        "install": release["install"],
        "capabilities": [
            {
                "id": package_id(skill_dir),
                "label": name,
                "summary": description,
                "entrypoint": f"Use skill `{skill_dir.name}` inside Forge Console / OpenClaw runtime.",
            }
        ],
        "dependencies": [],
        "compatibility": {
            "openclawMinVersion": "2026.3.2",
            "installMode": "local-console",
            "platforms": ["macos", "linux", "windows"],
        },
        "permissions": [
            {
                "key": "filesystem.read",
                "required": True,
                "reason": "Read the bundled skill files and references locally.",
            }
        ],
        "checksums": {
            "algorithm": "sha256",
            "files": checksums,
        },
        "docs": docs,
        "assets": assets,
        "reviewStatus": "draft",
        "visibility": "official" if is_official_skill(skill_dir) else "community",
    }
    (bundle_root / "community-package.json").write_text(json.dumps(community, ensure_ascii=False, indent=2), encoding="utf-8")

    archive_path = output_root / release["archiveFile"]
    if archive_path.exists():
        archive_path.unlink()
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in bundle_root.rglob("*"):
            if path.is_file():
                zf.write(path, path.relative_to(output_root))

    return {
        "packageId": community["packageId"],
        "name": community["name"],
        "version": community["version"],
        "zipPath": str(archive_path),
        "bundleDir": str(bundle_root),
        "mirrorStatus": community["source"]["mirrorStatus"],
        "visibility": community["visibility"],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skill")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--include-external", action="store_true")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    args = parser.parse_args()

    if not args.skill and not args.all:
      raise SystemExit("Provide --skill or use --all")

    output_root = Path(args.output_dir).expanduser().resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    skills = sorted(path.parent for path in SKILLS_ROOT.glob("*/SKILL.md"))
    if not args.include_external:
        skills = [skill_dir for skill_dir in skills if is_official_skill(skill_dir)]
    if args.all:
        result = [export_skill(skill_dir, output_root) for skill_dir in skills]
    else:
        match = next((skill_dir for skill_dir in skills if skill_dir.name == args.skill), None)
        if not match:
            raise SystemExit(f"Unknown skill: {args.skill}")
        result = [export_skill(match, output_root)]

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        for item in result:
            print(item["zipPath"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
