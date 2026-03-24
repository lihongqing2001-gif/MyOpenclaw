#!/usr/bin/env python3
import argparse
import json
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from _workspace_topology import repo_root, runtime_root

WORKSPACE_ROOT = repo_root()
RUNTIME_ROOT = runtime_root()
REGISTRY_ROOT = RUNTIME_ROOT / "packages" / "community_packages"
INSTALLED_ROOT = REGISTRY_ROOT / "installed"
REGISTRY_FILE = RUNTIME_ROOT / "agent" / "community-package-registry.json"

REQUIRED_FIELDS = [
    "schemaVersion",
    "packageId",
    "type",
    "name",
    "version",
    "author",
    "description",
    "capabilities",
    "dependencies",
    "compatibility",
    "permissions",
    "checksums",
    "docs",
    "assets",
    "reviewStatus",
    "visibility",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_json(path: Path, payload: Any) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def registry_payload() -> dict[str, Any]:
    return read_json(REGISTRY_FILE, {"packages": []})


def save_registry(payload: dict[str, Any]) -> None:
    write_json(REGISTRY_FILE, payload)


def manifest_from_capability_manifest(payload: dict[str, Any]) -> dict[str, Any]:
    package_id = payload.get("id", "cap.openclaw.unknown")
    return {
        "schemaVersion": "community-package-v1",
        "packageId": package_id,
        "type": "sop-pack",
        "name": payload.get("name", package_id),
        "version": payload.get("version", "0.0.0"),
        "author": {
            "name": "OpenClaw",
            "id": "official/openclaw",
        },
        "description": payload.get("description", ""),
        "source": {"kind": "local-export", "createdAt": now_iso()},
        "capabilities": [
            {
                "id": package_id,
                "label": payload.get("name", package_id),
                "summary": payload.get("description", ""),
                "entrypoint": (payload.get("entrypoints") or [{}])[0].get("command", ""),
            }
        ],
        "dependencies": [
            {
                "id": dependency_id,
                "label": dependency_id,
                "kind": "integration",
                "required": True,
                "bundled": False,
            }
            for dependency_id in payload.get("dependencies", [])
        ],
        "compatibility": {
            "openclawMinVersion": str(payload.get("requires", ">=0.0.0")).removeprefix(">="),
            "installMode": "local-console",
            "platforms": ["macos", "linux", "windows"],
        },
        "permissions": [],
        "checksums": {"algorithm": "sha256", "files": []},
        "docs": [{"title": "README", "path": "README.md"}],
        "assets": [],
        "reviewStatus": "draft",
        "visibility": "private",
    }


def load_package_manifest(package_path: Path) -> tuple[dict[str, Any], str]:
    if not package_path.exists():
        raise SystemExit(f"Package not found: {package_path}")
    if package_path.suffix.lower() != ".zip":
        raise SystemExit("Only .zip community packages are supported.")

    with zipfile.ZipFile(package_path, "r") as archive:
        members = archive.namelist()
        community_member = next((name for name in members if name.endswith("/community-package.json") or name == "community-package.json"), "")
        legacy_member = next((name for name in members if name.endswith("/capability-manifest.json") or name == "capability-manifest.json"), "")
        if community_member:
            manifest = json.loads(archive.read(community_member).decode("utf-8"))
            return manifest, community_member
        if legacy_member:
            legacy = json.loads(archive.read(legacy_member).decode("utf-8"))
            return manifest_from_capability_manifest(legacy), "capability-manifest.json"
    raise SystemExit("No supported manifest found in package archive.")


def validate_manifest(manifest: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    for field in REQUIRED_FIELDS:
        if field not in manifest:
            issues.append(f"Missing required field: {field}")
    if manifest.get("schemaVersion") != "community-package-v1":
        issues.append("schemaVersion must be community-package-v1")
    if manifest.get("compatibility", {}).get("installMode") != "local-console":
        issues.append("installMode must be local-console")
    return issues


def inspect_package(package_path: Path) -> dict[str, Any]:
    manifest, manifest_source = load_package_manifest(package_path)
    issues = validate_manifest(manifest)
    return {
        "success": len(issues) == 0,
        "packagePath": str(package_path),
        "manifestSource": manifest_source,
        "manifest": manifest,
        "validationIssues": issues,
        "installPreview": {
            "packageId": manifest.get("packageId", ""),
            "version": manifest.get("version", ""),
            "permissions": manifest.get("permissions", []),
            "dependencies": manifest.get("dependencies", []),
        },
    }


def install_root_for(package_id: str, version: str) -> Path:
    safe_package = package_id.replace("/", "__")
    return INSTALLED_ROOT / safe_package / version


def upsert_package_record(payload: dict[str, Any], record: dict[str, Any]) -> None:
    for index, item in enumerate(payload["packages"]):
        if item["packageId"] == record["packageId"]:
            payload["packages"][index] = record
            return
    payload["packages"].append(record)


def install_package(package_path: Path) -> dict[str, Any]:
    return install_package_with_metadata(
        package_path,
        {
            "distributionChannel": "local-file",
            "releaseUrl": "",
            "sourceRepo": "",
            "sourceTag": "",
        },
    )


def install_package_with_metadata(package_path: Path, metadata: dict[str, str]) -> dict[str, Any]:
    inspected = inspect_package(package_path)
    if not inspected["success"]:
        raise SystemExit("; ".join(inspected["validationIssues"]))
    manifest = inspected["manifest"]
    package_id = manifest["packageId"]
    version = manifest["version"]
    install_root = install_root_for(package_id, version)
    if install_root.exists():
        shutil.rmtree(install_root)
    ensure_dir(install_root)

    with zipfile.ZipFile(package_path, "r") as archive:
        archive.extractall(install_root)

    extracted_manifest_path = next(
        (
            path
            for path in install_root.rglob("community-package.json")
        ),
        None,
    )
    if extracted_manifest_path is None:
        extracted_manifest_path = next(
            (path for path in install_root.rglob("capability-manifest.json")),
            None,
        )
    bundle_root = extracted_manifest_path.parent if extracted_manifest_path else install_root

    registry = registry_payload()
    package_record = next((item for item in registry["packages"] if item["packageId"] == package_id), None)
    if not package_record:
        package_record = {
            "packageId": package_id,
            "name": manifest["name"],
            "type": manifest["type"],
            "author": manifest["author"],
            "activeVersion": version,
            "distributionChannel": metadata.get("distributionChannel", "local-file"),
            "releaseUrl": metadata.get("releaseUrl", ""),
            "sourceRepo": metadata.get("sourceRepo", ""),
            "sourceTag": metadata.get("sourceTag", ""),
            "installedVersions": [],
        }

    installed_versions = [item for item in package_record["installedVersions"] if item["version"] != version]
    installed_versions.append(
        {
            "version": version,
            "status": "enabled",
            "installedAt": now_iso(),
            "installPath": str(bundle_root),
            "sourcePath": str(package_path),
            "manifestPath": str(extracted_manifest_path) if extracted_manifest_path else "",
            "distributionChannel": metadata.get("distributionChannel", "local-file"),
            "releaseUrl": metadata.get("releaseUrl", ""),
            "sourceRepo": metadata.get("sourceRepo", ""),
            "sourceTag": metadata.get("sourceTag", ""),
            "permissions": manifest.get("permissions", []),
            "compatibility": manifest.get("compatibility", {}),
        }
    )
    package_record["installedVersions"] = sorted(installed_versions, key=lambda item: item["installedAt"])
    package_record["activeVersion"] = version
    package_record["distributionChannel"] = metadata.get("distributionChannel", package_record.get("distributionChannel", "local-file"))
    package_record["releaseUrl"] = metadata.get("releaseUrl", package_record.get("releaseUrl", ""))
    package_record["sourceRepo"] = metadata.get("sourceRepo", package_record.get("sourceRepo", ""))
    package_record["sourceTag"] = metadata.get("sourceTag", package_record.get("sourceTag", ""))
    upsert_package_record(registry, package_record)
    save_registry(registry)
    return {
        "success": True,
        "packageId": package_id,
        "version": version,
        "installPath": str(bundle_root),
        "manifest": manifest,
    }


def list_packages() -> dict[str, Any]:
    registry = registry_payload()
    return {"packages": registry["packages"]}


def update_version_status(package_id: str, version: str, enabled: bool) -> dict[str, Any]:
    registry = registry_payload()
    package_record = next((item for item in registry["packages"] if item["packageId"] == package_id), None)
    if not package_record:
      raise SystemExit(f"Unknown package: {package_id}")
    found = False
    for item in package_record["installedVersions"]:
        if item["version"] == version:
            item["status"] = "enabled" if enabled else "disabled"
            found = True
            if enabled:
                package_record["activeVersion"] = version
            elif package_record.get("activeVersion") == version:
                package_record["activeVersion"] = ""
    if not found:
        raise SystemExit(f"Version not installed: {version}")
    save_registry(registry)
    return {"success": True, "packageId": package_id, "version": version, "enabled": enabled}


def rollback_package(package_id: str, target_version: str = "") -> dict[str, Any]:
    registry = registry_payload()
    package_record = next((item for item in registry["packages"] if item["packageId"] == package_id), None)
    if not package_record:
        raise SystemExit(f"Unknown package: {package_id}")
    versions = package_record.get("installedVersions", [])
    if len(versions) < 2 and not target_version:
        raise SystemExit("No previous installed version is available for rollback.")
    if target_version:
        candidate = next((item for item in versions if item["version"] == target_version), None)
    else:
        active = package_record.get("activeVersion", "")
        previous_versions = [item for item in versions if item["version"] != active]
        candidate = previous_versions[-1] if previous_versions else None
    if not candidate:
        raise SystemExit("Rollback target version not found.")
    package_record["activeVersion"] = candidate["version"]
    candidate["status"] = "enabled"
    save_registry(registry)
    return {"success": True, "packageId": package_id, "activeVersion": candidate["version"]}


def uninstall_package(package_id: str, version: str) -> dict[str, Any]:
    registry = registry_payload()
    package_record = next((item for item in registry["packages"] if item["packageId"] == package_id), None)
    if not package_record:
        raise SystemExit(f"Unknown package: {package_id}")
    remaining = []
    removed = None
    for item in package_record["installedVersions"]:
        if item["version"] == version:
            removed = item
            continue
        remaining.append(item)
    if not removed:
        raise SystemExit(f"Version not installed: {version}")
    install_path = Path(removed["installPath"])
    if install_path.exists():
        shutil.rmtree(install_path)
    package_record["installedVersions"] = remaining
    if package_record.get("activeVersion") == version:
        package_record["activeVersion"] = remaining[-1]["version"] if remaining else ""
    if not remaining:
        registry["packages"] = [item for item in registry["packages"] if item["packageId"] != package_id]
    save_registry(registry)
    return {"success": True, "packageId": package_id, "removedVersion": version}


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    inspect_parser = subparsers.add_parser("inspect")
    inspect_parser.add_argument("--package-path", required=True)

    install_parser = subparsers.add_parser("install")
    install_parser.add_argument("--package-path", required=True)
    install_parser.add_argument("--distribution-channel", default="local-file")
    install_parser.add_argument("--release-url", default="")
    install_parser.add_argument("--source-repo", default="")
    install_parser.add_argument("--source-tag", default="")

    list_parser = subparsers.add_parser("list")

    enable_parser = subparsers.add_parser("enable")
    enable_parser.add_argument("--package-id", required=True)
    enable_parser.add_argument("--version", required=True)

    disable_parser = subparsers.add_parser("disable")
    disable_parser.add_argument("--package-id", required=True)
    disable_parser.add_argument("--version", required=True)

    rollback_parser = subparsers.add_parser("rollback")
    rollback_parser.add_argument("--package-id", required=True)
    rollback_parser.add_argument("--target-version", default="")

    uninstall_parser = subparsers.add_parser("uninstall")
    uninstall_parser.add_argument("--package-id", required=True)
    uninstall_parser.add_argument("--version", required=True)

    args = parser.parse_args()

    if args.command == "inspect":
        result = inspect_package(Path(args.package_path).expanduser().resolve())
    elif args.command == "install":
        result = install_package_with_metadata(
            Path(args.package_path).expanduser().resolve(),
            {
                "distributionChannel": args.distribution_channel,
                "releaseUrl": args.release_url,
                "sourceRepo": args.source_repo,
                "sourceTag": args.source_tag,
            },
        )
    elif args.command == "list":
        result = list_packages()
    elif args.command == "enable":
        result = update_version_status(args.package_id, args.version, True)
    elif args.command == "disable":
        result = update_version_status(args.package_id, args.version, False)
    elif args.command == "rollback":
        result = rollback_package(args.package_id, args.target_version)
    elif args.command == "uninstall":
        result = uninstall_package(args.package_id, args.version)
    else:
        raise SystemExit(f"Unsupported command: {args.command}")

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
