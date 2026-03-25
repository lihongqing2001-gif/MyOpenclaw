#!/usr/bin/env python3
import argparse
import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any


WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
PROJECT_ROOT = Path(__file__).resolve().parents[1]
SKILLS_ROOT = WORKSPACE_ROOT / "skills"
SOPS_ROOT = WORKSPACE_ROOT / "sops"
RUNTIME_ROOT = WORKSPACE_ROOT.parent / "runtime" / "public-resource-repos"
DEFAULT_OWNER = "openclaw-labs"

REPOS = {
    "skills": "openclaw-skills",
    "sops": "openclaw-sops",
    "demos": "openclaw-demos",
    "tutorials": "openclaw-tutorials",
    "cases": "openclaw-cases",
}


def github_owner() -> str:
    value = (os.environ.get("OPENCLAW_RESOURCE_GITHUB_OWNER") or "").strip()
    if value:
        return value
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
    return DEFAULT_OWNER


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "item"


def ensure_repo_dir(name: str) -> Path:
    repo_dir = RUNTIME_ROOT / name
    repo_dir.mkdir(parents=True, exist_ok=True)
    return repo_dir


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def copytree(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(
        src,
        dst,
        ignore=shutil.ignore_patterns(".git", ".venv", "__pycache__", "*.pyc", ".DS_Store"),
    )


def build_release_manifest(resource_type: str, resource_id: str, name: str, version: str, repo_name: str, slug: str, mirror_status: str, license_name: str) -> dict[str, Any]:
    owner = github_owner()
    homepage = f"https://github.com/{owner}/{repo_name}/tree/main/resources/{slug}"
    return {
        "schemaVersion": "openclaw-resource-release-v1",
        "resourceType": resource_type,
        "resourceId": resource_id,
        "name": name,
        "version": version,
        "artifactType": "github-resource-directory",
        "source": {
            "repository": f"https://github.com/{owner}/{repo_name}",
            "homepage": homepage,
            "license": license_name,
            "mirrorStatus": mirror_status,
        },
        "license": license_name,
        "install": {
            "via": "forge-console",
            "command": f"Open Forge Console and install `{resource_id}` from the official resource bundle.",
            "url": homepage,
            "notes": [
                "Use GitHub as the public distribution surface.",
                "Use Forge Console as the local install surface.",
            ],
        },
        "homepage": homepage,
        "archiveFile": "",
        "builtAt": subprocess.run(["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"], capture_output=True, text=True).stdout.strip(),
    }


def build_skill_entries() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    official: list[dict[str, Any]] = []
    external: list[dict[str, Any]] = []
    for skill_md in sorted(SKILLS_ROOT.glob("*/SKILL.md")):
        skill_dir = skill_md.parent
        slug = slugify(skill_dir.name)
        content = skill_md.read_text(encoding="utf-8")
        name_match = re.search(r"^name:\s*(.+)$", content, re.MULTILINE)
        desc_match = re.search(r"^description:\s*(.+)$", content, re.MULTILINE)
        name = name_match.group(1).strip().strip('"') if name_match else skill_dir.name
        description = desc_match.group(1).strip().strip('"') if desc_match else f"Skill resource for {name}"
        resource = {
            "slug": slug,
            "name": name,
            "description": description,
            "resourceId": f"cap.openclaw.skill.{slug}",
            "path": str(skill_dir),
        }
        if (skill_dir / "_meta.json").exists():
            external.append({
                **resource,
                "mirrorStatus": "upstream-only",
                "license": "Unknown",
                "sourceRepo": "",
                "installCommand": f"Install upstream skill `{skill_dir.name}` according to its original distribution instructions.",
                "installUrl": "",
            })
        else:
            official.append(resource)
    return official, external


def build_sop_entries() -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for sop_path in sorted(SOPS_ROOT.glob("*.md")):
        slug = slugify(sop_path.stem)
        title = sop_path.stem.replace("_", " ")
        entries.append(
            {
                "slug": slug,
                "name": title,
                "description": f"SOP resource for {title}",
                "resourceId": f"cap.openclaw.sop.{slug}",
                "path": str(sop_path),
            }
        )
    return entries


def write_repo_readme(repo_dir: Path, repo_name: str, title: str, description: str) -> None:
    (repo_dir / "README.md").write_text(
        f"# {title}\n\n{description}\n\n## Layout\n\n- `resources/` contains public resource directories\n- `index.json` is the machine-readable catalog\n- `third-party-audit.json` tracks upstream-only resources\n",
        encoding="utf-8",
    )


def sync_skills_repo() -> dict[str, Any]:
    repo_name = REPOS["skills"]
    repo_dir = ensure_repo_dir(repo_name)
    resources_dir = repo_dir / "resources"
    resources_dir.mkdir(parents=True, exist_ok=True)
    official, external = build_skill_entries()
    catalog: list[dict[str, Any]] = []

    for entry in official:
        resource_dir = resources_dir / entry["slug"]
        resource_dir.mkdir(parents=True, exist_ok=True)
        copytree(Path(entry["path"]), resource_dir / "skill")
        manifest = build_release_manifest("skill-pack", entry["resourceId"], entry["name"], "0.1.0", repo_name, entry["slug"], "official", "Proprietary")
        (resource_dir / "release-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        (resource_dir / "install.md").write_text(
            f"# Install {entry['name']}\n\n1. Download the official skill pack or clone this resource directory.\n2. Import it in Forge Console.\n3. Install `{entry['resourceId']}` locally.\n",
            encoding="utf-8",
        )
        (resource_dir / "README.md").write_text(
            f"# {entry['name']}\n\n{entry['description']}\n\n- Resource ID: `{entry['resourceId']}`\n- Homepage: {manifest['homepage']}\n",
            encoding="utf-8",
        )
        catalog.append({"slug": entry["slug"], "name": entry["name"], "resourceId": entry["resourceId"], "version": "0.1.0", "mirrorStatus": "official"})

    write_repo_readme(repo_dir, repo_name, "OpenClaw Skills", "Official public skill resources for Forge Console and Forge Hub.")
    write_json(repo_dir / "index.json", {"resources": catalog})
    write_json(repo_dir / "third-party-audit.json", {"resources": external})
    return {"official": len(official), "external": len(external)}


def sync_sops_repo() -> dict[str, Any]:
    repo_name = REPOS["sops"]
    repo_dir = ensure_repo_dir(repo_name)
    resources_dir = repo_dir / "resources"
    resources_dir.mkdir(parents=True, exist_ok=True)
    catalog: list[dict[str, Any]] = []
    for entry in build_sop_entries():
        resource_dir = resources_dir / entry["slug"]
        resource_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(entry["path"], resource_dir / Path(entry["path"]).name)
        manifest = build_release_manifest("sop-pack", entry["resourceId"], entry["name"], "0.1.0", repo_name, entry["slug"], "official", "Proprietary")
        (resource_dir / "release-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        (resource_dir / "install.md").write_text(
            f"# Install {entry['name']}\n\n1. Download the SOP pack release or clone this directory.\n2. Import it in Forge Console.\n3. Install `{entry['resourceId']}` locally.\n",
            encoding="utf-8",
        )
        (resource_dir / "README.md").write_text(
            f"# {entry['name']}\n\n{entry['description']}\n\n- Resource ID: `{entry['resourceId']}`\n- Homepage: {manifest['homepage']}\n",
            encoding="utf-8",
        )
        catalog.append({"slug": entry["slug"], "name": entry["name"], "resourceId": entry["resourceId"], "version": "0.1.0", "mirrorStatus": "official"})

    write_repo_readme(repo_dir, repo_name, "OpenClaw SOPs", "Official public SOP resources for Forge Console and Forge Hub.")
    write_json(repo_dir / "index.json", {"resources": catalog})
    write_json(repo_dir / "third-party-audit.json", {"resources": []})
    return {"official": len(catalog), "external": 0}


def sync_placeholder_repo(resource_key: str, title: str, description: str) -> dict[str, Any]:
    repo_name = REPOS[resource_key]
    repo_dir = ensure_repo_dir(repo_name)
    write_repo_readme(repo_dir, repo_name, title, description)
    write_json(repo_dir / "index.json", {"resources": []})
    write_json(repo_dir / "third-party-audit.json", {"resources": []})
    return {"official": 0, "external": 0}


def ensure_git_repo(repo_dir: Path, repo_name: str) -> None:
    if not (repo_dir / ".git").exists():
        subprocess.run(["git", "init", "-b", "main"], cwd=repo_dir, check=True)
    subprocess.run(["git", "config", "user.name", "OpenClaw Bot"], cwd=repo_dir, check=True)
    subprocess.run(["git", "config", "user.email", "openclaw-bot@users.noreply.github.com"], cwd=repo_dir, check=True)
    subprocess.run(["git", "add", "."], cwd=repo_dir, check=True)
    status = subprocess.run(["git", "status", "--short"], cwd=repo_dir, capture_output=True, text=True, check=True)
    if status.stdout.strip():
        subprocess.run(["git", "commit", "-m", "Initialize public resource catalog"], cwd=repo_dir, check=True)


def push_repo(repo_dir: Path, repo_name: str) -> None:
    owner = github_owner()
    ensure_git_repo(repo_dir, repo_name)
    view = subprocess.run(["gh", "repo", "view", f"{owner}/{repo_name}"], capture_output=True, text=True, check=False)
    if view.returncode != 0:
        subprocess.run(["gh", "repo", "create", f"{owner}/{repo_name}", "--public", "--source", str(repo_dir), "--remote", "origin", "--push"], check=True)
        return
    subprocess.run(["git", "remote", "remove", "origin"], cwd=repo_dir, check=False)
    subprocess.run(["git", "remote", "add", "origin", f"https://github.com/{owner}/{repo_name}.git"], cwd=repo_dir, check=True)
    subprocess.run(["git", "add", "."], cwd=repo_dir, check=True)
    status = subprocess.run(["git", "status", "--short"], cwd=repo_dir, capture_output=True, text=True, check=True)
    if not status.stdout.strip():
        return
    subprocess.run(["git", "commit", "-m", "Sync public resource catalog"], cwd=repo_dir, check=True)
    subprocess.run(["git", "push", "-u", "origin", "main"], cwd=repo_dir, check=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--push", action="store_true")
    args = parser.parse_args()

    results = {
        REPOS["skills"]: sync_skills_repo(),
        REPOS["sops"]: sync_sops_repo(),
        REPOS["demos"]: sync_placeholder_repo("demos", "OpenClaw Demos", "Public demo resources will be published here."),
        REPOS["tutorials"]: sync_placeholder_repo("tutorials", "OpenClaw Tutorials", "Public tutorial resources will be published here."),
        REPOS["cases"]: sync_placeholder_repo("cases", "OpenClaw Cases", "Public case resources will be published here."),
    }

    if args.push:
        for repo_name in REPOS.values():
            push_repo(ensure_repo_dir(repo_name), repo_name)

    print(json.dumps({"owner": github_owner(), "repos": results, "root": str(RUNTIME_ROOT)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
