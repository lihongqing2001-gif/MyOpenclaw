import argparse
import json
import os
import subprocess
from pathlib import Path

from _short_video_factory import (
    DEFAULT_SERIES,
    account_folder_name,
    detect_platform,
    month_instance,
    now_iso,
    read_json,
    read_library_root,
    series_paths,
    write_json,
    write_text,
)


SCRIPT_DIR = Path(__file__).resolve().parent


def call_script(command: list[str], env: dict[str, str] | None = None) -> dict:
    process = subprocess.run(
        command,
        cwd=SCRIPT_DIR,
        capture_output=True,
        text=True,
        timeout=1800,
        env=env,
    )
    if process.returncode != 0:
        raise SystemExit(process.stderr or process.stdout or "short video raw collect step failed")
    return json.loads(process.stdout)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest-path", required=True)
    parser.add_argument("--project-series", default=DEFAULT_SERIES)
    parser.add_argument("--project-instance", default="")
    parser.add_argument("--api-key", default=os.getenv("API_KEY", ""))
    parser.add_argument("--skip-existing", action="store_true")
    args = parser.parse_args()

    manifest_path = Path(args.manifest_path).expanduser().resolve()
    if not manifest_path.exists():
        raise SystemExit(f"Manifest not found: {manifest_path}")

    manifest = read_json(manifest_path)
    library_root = read_library_root()
    instance = args.project_instance or manifest.get("project_instance") or month_instance("短视频对标试点")
    series = args.project_series or manifest.get("project_series") or DEFAULT_SERIES
    account_folder = manifest.get("account_folder") or account_folder_name(
        manifest.get("account_name", ""),
        manifest.get("account_handle", ""),
    )

    raw_runs: list[dict] = []
    for item in manifest.get("links", []):
        url = str(item.get("url", "")).strip()
        if not url:
            continue
        platform = str(item.get("platform", "")).strip().lower() or detect_platform(url)
        if platform != "douyin":
            raise SystemExit(f"Unsupported platform for raw collect: {url}")
        content_id = ""
        if args.skip_existing:
            raw_root = series_paths(library_root, series, instance)["asset_base"] / "raw" / platform / account_folder
            if raw_root.exists():
                for child in raw_root.iterdir():
                    raw_info = child / "raw_video_info.json"
                    if raw_info.exists():
                        payload = read_json(raw_info)
                        raw_url = str(payload.get("original_share_text") or "")
                        if url in raw_url:
                            content_id = child.name
                            break
        if content_id:
            raw_runs.append(
                {
                    "success": True,
                    "content_id": content_id,
                    "platform": platform,
                    "skipped_existing": True,
                }
            )
            continue

        env = os.environ.copy()
        if args.api_key:
            env["API_KEY"] = args.api_key
        result = call_script(
            [
                "python3",
                str(SCRIPT_DIR / "run_douyin_single_video_analysis.py"),
                "--video-url",
                url,
                "--project-series",
                series,
                "--project-instance",
                instance,
                "--account-folder",
                account_folder,
                *(["--api-key", args.api_key] if args.api_key else []),
            ],
            env=env,
        )
        raw_runs.append(result)

    output_dir = (
        series_paths(library_root, series, instance)["asset_base"]
        / "deliverables"
        / "account-research"
        / "douyin"
        / account_folder
    )
    summary_path = output_dir / "raw_collection_summary.json"
    summary_md_path = output_dir / "raw_collection_summary__runtime.md"
    summary = {
        "account_name": manifest.get("account_name", ""),
        "account_handle": manifest.get("account_handle", ""),
        "sample_manifest": str(manifest_path),
        "project_series": series,
        "project_instance": instance,
        "generated_at": now_iso(),
        "runs": raw_runs,
    }
    write_json(summary_path, summary)
    write_text(
        summary_md_path,
        "# Raw Collection Summary\n\n" + "\n".join(
            f"- {item.get('platform', '')} · {item.get('content_id', item.get('video_id', ''))} · {'existing' if item.get('skipped_existing') else 'collected'}"
            for item in raw_runs
        ),
    )

    print(
        json.dumps(
            {
                "success": True,
                "summary_path": str(summary_path),
                "summary_md_path": str(summary_md_path),
                "run_count": len(raw_runs),
                "execution_summary": f"已完成 {manifest.get('account_name', '目标账号')} 的 raw 收集，共 {len(raw_runs)} 条。",
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
