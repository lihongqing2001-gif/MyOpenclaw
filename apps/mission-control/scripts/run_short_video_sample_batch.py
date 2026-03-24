import argparse
import json

from _short_video_factory import (
    DEFAULT_MIN_SAMPLE_SIZE,
    DEFAULT_SAMPLE_SIZE,
    DEFAULT_SERIES,
    DEFAULT_TARGET_MODE,
    account_folder_name,
    build_intake_dir,
    detect_platform,
    month_instance,
    now_iso,
    read_library_root,
    write_json,
    write_links_csv,
)


def normalize_links(raw_links: list[dict]) -> list[dict]:
    normalized = []
    for index, item in enumerate(raw_links, start=1):
        url = str(item.get("url", "")).strip()
        if not url:
            continue
        platform = str(item.get("platform", "")).strip().lower() or detect_platform(url)
        normalized.append(
            {
                "id": item.get("id") or f"sample-{index:03d}",
                "platform": platform,
                "url": url,
                "note": str(item.get("note", "")).strip(),
            }
        )
    return normalized


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--platform", default="mixed")
    parser.add_argument("--account-name", required=True)
    parser.add_argument("--account-handle", default="")
    parser.add_argument("--objective", default="建立对标账号样本批次并进入短视频资产工厂")
    parser.add_argument("--sample-size", type=int, default=DEFAULT_SAMPLE_SIZE)
    parser.add_argument("--target-mode", default=DEFAULT_TARGET_MODE)
    parser.add_argument("--batch-id", default="batch-001")
    parser.add_argument("--project-series", default=DEFAULT_SERIES)
    parser.add_argument("--project-instance", default="")
    parser.add_argument("--links-json", required=True)
    args = parser.parse_args()

    raw_links = json.loads(args.links_json)
    links = normalize_links(raw_links)
    if len(links) < DEFAULT_MIN_SAMPLE_SIZE:
        raise SystemExit(f"At least {DEFAULT_MIN_SAMPLE_SIZE} links are required.")

    library_root = read_library_root()
    instance = args.project_instance or month_instance()
    account_folder = account_folder_name(args.account_name, args.account_handle)
    intake_dir = build_intake_dir(
        library_root,
        args.project_series,
        instance,
        args.platform,
        account_folder,
        args.batch_id,
    )

    manifest = {
        "platform": args.platform,
        "account_name": args.account_name,
        "account_handle": args.account_handle,
        "account_folder": account_folder,
        "batch_id": args.batch_id,
        "objective": args.objective,
        "sample_size": args.sample_size,
        "target_mode": args.target_mode,
        "project_series": args.project_series,
        "project_instance": instance,
        "created_at": now_iso(),
        "links": links,
    }

    manifest_path = intake_dir / "sample_manifest.json"
    csv_path = intake_dir / "source_links.csv"
    write_json(manifest_path, manifest)
    write_links_csv(csv_path, links)

    print(
        json.dumps(
            {
                "success": True,
                "platform": args.platform,
                "account_name": args.account_name,
                "account_handle": args.account_handle,
                "account_folder": account_folder,
                "project_series": args.project_series,
                "project_instance": instance,
                "batch_id": args.batch_id,
                "sample_manifest": str(manifest_path),
                "source_links_csv": str(csv_path),
                "sample_count": len(links),
                "execution_summary": f"已创建 {args.account_name} 的短视频样本批次，共 {len(links)} 条链接。",
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
