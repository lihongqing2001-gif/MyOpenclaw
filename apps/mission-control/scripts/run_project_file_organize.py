import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path
import shutil


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
      while True:
        chunk = handle.read(1024 * 1024)
        if not chunk:
          break
        digest.update(chunk)
    return digest.hexdigest()


def build_manifest(target_dir: Path) -> dict:
    files = []
    for file_path in sorted(target_dir.rglob("*")):
        if file_path.is_file():
            rel = file_path.relative_to(target_dir)
            files.append(
                {
                    "path": str(rel),
                    "size": file_path.stat().st_size,
                    "sha256": sha256_file(file_path),
                }
            )
    return {
        "generated_at": datetime.now().astimezone().isoformat(),
        "target_dir": str(target_dir),
        "files": files,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target-dir", required=True)
    parser.add_argument("--rule", default="")
    args = parser.parse_args()

    target_dir = Path(args.target_dir).expanduser().resolve()
    if not target_dir.exists() or not target_dir.is_dir():
        raise SystemExit(f"Target directory not found: {target_dir}")

    archive_root = target_dir.parent / "07_archive" / target_dir.name
    archive_root.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d-%H%M")
    snapshot_dir = archive_root / stamp
    snapshot_dir.mkdir(parents=True, exist_ok=True)

    manifest = build_manifest(target_dir)
    latest_manifests = sorted(archive_root.glob("*/manifest.json"))
    if latest_manifests:
        previous = json.loads(latest_manifests[-1].read_text())
        if previous.get("files") == manifest.get("files"):
            shutil.rmtree(snapshot_dir, ignore_errors=True)
            print(
                json.dumps(
                    {
                        "success": True,
                        "action": "skipped",
                        "message": "Latest archive snapshot is identical. No new snapshot created.",
                        "archive_root": str(archive_root),
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
            return 0

    for item in target_dir.iterdir():
        if item.name in {"07_archive", ".DS_Store", ".localized"}:
            continue
        destination = snapshot_dir / item.name
        if item.is_dir():
            shutil.copytree(item, destination, dirs_exist_ok=True)
        else:
            shutil.copy2(item, destination)

    manifest_path = snapshot_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = {
        "success": True,
        "action": "archived",
        "message": "Created non-destructive archive snapshot.",
        "target_dir": str(target_dir),
        "archive_dir": str(snapshot_dir),
        "rule": args.rule,
        "manifest": str(manifest_path),
        "file_count": len(manifest["files"]),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
