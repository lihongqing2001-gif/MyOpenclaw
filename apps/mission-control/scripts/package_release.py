#!/usr/bin/env python3
import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

RELEASE_SCHEMA_VERSION = "forge-console-release-v1"
RUNTIME_INCLUDE_PATHS = (
    "dist",
    "src",
    "scripts",
    "server.ts",
    "start_app.py",
    "openclaw_agent.py",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "vite.config.ts",
    "index.html",
    "metadata.json",
    "README.md",
    "USER_MANUAL.md",
)


def main() -> None:
    project_root = Path(__file__).resolve().parent.parent
    release_root = project_root / "releases"
    release_root.mkdir(exist_ok=True)

    version = _read_package_version(project_root)
    git_meta = _git_metadata(project_root)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    release_name = f"release-v{version}-{stamp}"
    archive_name = f"forge-console-local-runtime-v{version}-{stamp}"
    release_dir = release_root / release_name

    if release_dir.exists():
        shutil.rmtree(release_dir)
    release_dir.mkdir(parents=True)

    _run_build(project_root)

    _copy_runtime_bundle(project_root, release_dir)
    _write_launcher_scripts(release_dir)
    manifest = _write_release_manifest(release_dir, version, f"{archive_name}.zip", git_meta)

    archive_base = release_root / archive_name
    if (release_root / f"{archive_name}.zip").exists():
        (release_root / f"{archive_name}.zip").unlink()
    shutil.make_archive(str(archive_base), "zip", root_dir=release_dir)

    latest_manifest_path = release_root / "latest.json"
    latest_manifest_path.write_text(
        json.dumps(
            {
                **manifest,
                "archiveFile": f"{archive_name}.zip",
                "archivePath": str((archive_base.with_suffix(".zip")).resolve()),
                "releaseDir": str(release_dir.resolve()),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print("Created release bundle:")
    print(f"  directory -> {release_dir}")
    print(f"  archive   -> {archive_base}.zip")
    print(f"  manifest  -> {release_dir / 'release-manifest.json'}")
    print(f"  latest    -> {latest_manifest_path}")


def _run_build(root: Path) -> None:
    print("Running npm run build")
    subprocess.run(["npm", "run", "build"], cwd=root, check=True)


def _read_package_version(root: Path) -> str:
    package_path = root / "package.json"
    if not package_path.exists():
        return "0.0.0"
    data = json.loads(package_path.read_text(encoding="utf-8"))
    raw_version = data.get("version", "0.0.0")
    return raw_version.lstrip("v")


def _copy_tree(src: Path, dest: Path) -> None:
    if src.is_dir():
        shutil.copytree(src, dest)
    elif src.is_file():
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
    else:
        print(f"Warning: {src} not found; skipping")


def _copy_runtime_bundle(project_root: Path, release_dir: Path) -> None:
    for relative_path in RUNTIME_INCLUDE_PATHS:
        _copy_tree(project_root / relative_path, release_dir / relative_path)


def _write_launcher_scripts(release_dir: Path) -> None:
    launch_sh = release_dir / "launch.sh"
    launch_command = release_dir / "Forge Console.command"
    launch_bat = release_dir / "launch.bat"

    shell_script = """#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d node_modules ]; then
  echo "Installing npm dependencies..."
  npm install
fi

python3 start_app.py
"""
    launch_sh.write_text(shell_script, encoding="utf-8")
    launch_command.write_text(shell_script, encoding="utf-8")
    launch_bat.write_text(
        """@echo off
setlocal
cd /d %~dp0
if not exist node_modules (
  echo Installing npm dependencies...
  call npm install
)
python start_app.py
""",
        encoding="utf-8",
    )
    for target in (launch_sh, launch_command):
        target.chmod(0o755)


def _git_metadata(root: Path) -> dict:
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


def _write_release_manifest(release_dir: Path, version: str, archive_file: str, git_meta: dict) -> dict:
    built_at = datetime.now(timezone.utc).isoformat()
    manifest = {
        "schemaVersion": RELEASE_SCHEMA_VERSION,
        "appId": "forge-console",
        "name": "Forge Console",
        "version": version,
        "artifactType": "local-runtime-bundle",
        "archiveFile": archive_file,
        "platforms": ["macos", "windows", "linux"],
        "builtAt": built_at,
        "launchers": {
            "macos": "Forge Console.command",
            "windows": "launch.bat",
            "linux": "launch.sh",
        },
        "entrypoints": {
            "default": "python3 start_app.py",
            "broker": "npm run start",
            "agent": "python3 openclaw_agent.py",
        },
        "git": git_meta,
        "notes": [
            "This is a runnable local bundle, not a notarized native .app package.",
            "Install dependencies on first launch via npm install if node_modules is absent.",
        ],
        "includedPaths": list(_iter_release_paths(release_dir)),
    }
    (release_dir / "release-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return manifest


def _iter_release_paths(release_dir: Path) -> Iterable[str]:
    for path in sorted(release_dir.rglob("*")):
        if path.is_file() and "__pycache__" not in path.parts:
            yield str(path.relative_to(release_dir))


if __name__ == "__main__":
    main()
