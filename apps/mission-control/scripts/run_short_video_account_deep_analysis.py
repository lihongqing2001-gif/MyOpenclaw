import argparse
import concurrent.futures
import json
import subprocess
from pathlib import Path

from _short_video_factory import (
    DEFAULT_SERIES,
    account_folder_name,
    derive_deliverable_dir_from_raw_video,
    load_raw_video_records,
    month_instance,
    now_iso,
    read_json,
    read_library_root,
    write_json,
    write_text,
)


SCRIPT_DIR = Path(__file__).resolve().parent


def analyze_one(record: dict, model: str, rounds_profile: str, max_rounds: int) -> dict:
    video_path = record.get("video_path")
    transcript_path = record.get("transcript_path")
    if not video_path:
        return {
            "content_id": record.get("content_id", ""),
            "success": False,
            "error": "video_path missing",
        }

    output_dir = derive_deliverable_dir_from_raw_video(Path(video_path))
    report_path = output_dir / "分析报告__gemini多轮增强__runtime.md"
    child_copy_path = output_dir / "文案与讲解分析__runtime.md"
    child_rhythm_path = output_dir / "节奏与转场分析__runtime.md"
    if report_path.exists() and child_copy_path.exists() and child_rhythm_path.exists():
        return {
            "content_id": record.get("content_id", ""),
            "title": record.get("title", ""),
            "success": True,
            "skipped_existing": True,
            "report_path": str(report_path),
            "output_dir": str(output_dir),
        }

    command = [
        "python3",
        str(SCRIPT_DIR / "run_gemini_video_multiturn_analysis.py"),
        "--video-path",
        video_path,
        "--model",
        model,
        "--rounds-profile",
        rounds_profile,
        "--max-rounds",
        str(max_rounds),
    ]
    if transcript_path:
        command.extend(["--transcript-path", transcript_path])
    else:
        command.append("--skip-transcribe")

    process = subprocess.run(
        command,
        cwd=SCRIPT_DIR,
        capture_output=True,
        text=True,
        timeout=7200,
    )
    if process.returncode != 0:
        return {
            "content_id": record.get("content_id", ""),
            "success": False,
            "error": process.stderr or process.stdout or "deep analysis failed",
        }
    payload = json.loads(process.stdout)
    payload["content_id"] = record.get("content_id", "")
    payload["title"] = record.get("title", "")
    return payload


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest-path", required=True)
    parser.add_argument("--project-series", default=DEFAULT_SERIES)
    parser.add_argument("--project-instance", default="")
    parser.add_argument("--model", default="gemini-3-pro")
    parser.add_argument("--rounds-profile", default="deep-video-analysis-v1")
    parser.add_argument("--max-rounds", type=int, default=3)
    parser.add_argument("--max-workers", type=int, default=2)
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
    platform = str(manifest.get("platform", "douyin")).strip().lower() or "douyin"

    records = load_raw_video_records(library_root, series, instance, platform, account_folder)
    if not records:
        raise SystemExit("No raw video records found for deep analysis stage")

    results: list[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.max_workers)) as executor:
        futures = [
            executor.submit(analyze_one, record, args.model, args.rounds_profile, args.max_rounds)
            for record in records
        ]
        for future in concurrent.futures.as_completed(futures):
            results.append(future.result())

    output_dir = (
        library_root
        / "assets"
        / series
        / instance
        / "deliverables"
        / "account-research"
        / platform
        / account_folder
    )
    batch_path = output_dir / "deep_analysis_batch.json"
    batch_md_path = output_dir / "deep_analysis_batch__runtime.md"
    payload = {
        "account_name": manifest.get("account_name", ""),
        "account_handle": manifest.get("account_handle", ""),
        "sample_manifest": str(manifest_path),
        "generated_at": now_iso(),
        "model": args.model,
        "rounds_profile": args.rounds_profile,
        "max_rounds": args.max_rounds,
        "results": sorted(results, key=lambda item: item.get("content_id", "")),
    }
    write_json(batch_path, payload)
    write_text(
        batch_md_path,
        "# Deep Analysis Batch\n\n" + "\n".join(
            f"- {item.get('content_id', '')} · "
            f"{'existing' if item.get('skipped_existing') else ('success' if item.get('success') else 'failed')} · "
            f"{item.get('report_path', item.get('error', ''))}"
            for item in sorted(results, key=lambda item: item.get("content_id", ""))
        ),
    )

    print(
        json.dumps(
            {
                "success": True,
                "batch_path": str(batch_path),
                "batch_md_path": str(batch_md_path),
                "count": len(results),
                "execution_summary": f"已完成 {manifest.get('account_name', '目标账号')} 的并行 Gemini 深拆，共 {len(results)} 条。",
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
