#!/usr/bin/env python3
import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def main() -> None:
    project_root = Path(__file__).resolve().parent.parent
    release_root = project_root / "releases"
    release_root.mkdir(exist_ok=True)

    version = _read_package_version(project_root)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    release_name = f"release-v{version}-{stamp}"
    release_dir = release_root / release_name

    if release_dir.exists():
        shutil.rmtree(release_dir)
    release_dir.mkdir(parents=True)

    _run_build(project_root)

    _copy_tree(project_root / "dist", release_dir / "dist")
    for doc in ("README.md", "USER_MANUAL.md"):
        src = project_root / doc
        if src.exists():
            shutil.copy2(src, release_dir / doc)

    archive_base = release_root / release_name
    if (release_root / f"{release_name}.zip").exists():
        (release_root / f"{release_name}.zip").unlink()
    shutil.make_archive(str(archive_base), "zip", root_dir=release_dir)

    print("Created release bundle:")
    print(f"  directory -> {release_dir}")
    print(f"  archive   -> {archive_base}.zip")


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
    if src.exists():
        shutil.copytree(src, dest)
    else:
        print(f"Warning: {src} not found; release bundle will not have dist/")


if __name__ == "__main__":
    main()
