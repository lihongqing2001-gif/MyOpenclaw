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
    sanitize_segment,
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
        raise SystemExit(process.stderr or process.stdout or "short video research step failed")
    return json.loads(process.stdout)


def normalize_selected_platform(manifest: dict) -> str:
    platform = str(manifest.get("platform", "")).strip().lower()
    return platform if platform in {"douyin", "xiaohongshu"} else "mixed"


def collect_analysis(summary: dict) -> dict:
    analysis_path = summary.get("analysis_json")
    if analysis_path and Path(analysis_path).exists():
        return read_json(Path(analysis_path))
    raw_payload = summary.get("raw_payload")
    return {"content_id": sanitize_segment(Path(raw_payload).stem if raw_payload else "content")}


def build_bundle(
    manifest: dict,
    content_analyses: list[dict],
    content_runs: list[dict],
    output_paths: dict[str, Path],
) -> dict:
    source_contents = [
        {
            "content_id": item.get("content_id", ""),
            "platform": item.get("platform", ""),
            "title": item.get("title", ""),
            "hook": item.get("hook", ""),
            "structure": item.get("structure", ""),
            "analysis_json": run.get("analysis_json", ""),
            "analysis_report": run.get("analysis_report", ""),
            "knowledge_case": run.get("knowledge_case", ""),
            "artifact_refs": [
                run.get("analysis_report", ""),
                run.get("transcript_asset", ""),
                run.get("video_asset", ""),
            ],
        }
        for item, run in zip(content_analyses, content_runs)
    ]

    return {
        "source_account": {
            "name": manifest.get("account_name", ""),
            "handle": manifest.get("account_handle", ""),
            "folder": manifest.get("account_folder", ""),
        },
        "sample_manifest": manifest,
        "sample_count": len(content_analyses),
        "generated_at": now_iso(),
        "source_contents": source_contents,
        "reports": {key: str(value) for key, value in output_paths.items()},
    }


def build_account_report_md(bundle: dict, title: str, body_lines: list[str]) -> str:
    return f"""# {title}

## 账号信息

- 账号：{bundle['source_account']['name']}
- Handle：{bundle['source_account']['handle']}
- 样本数：{bundle['sample_count']}
- 生成时间：{bundle['generated_at']}

## 结论

""" + "\n".join(f"- {line}" for line in body_lines) + """

## 样本内容

""" + "\n".join(
        f"- {item['platform']} · {item['title']} · {item['content_id']}" for item in bundle["source_contents"]
    ) + """
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest-path", required=True)
    parser.add_argument("--project-series", default=DEFAULT_SERIES)
    parser.add_argument("--project-instance", default="")
    parser.add_argument("--api-key", default=os.getenv("API_KEY", ""))
    args = parser.parse_args()

    manifest_path = Path(args.manifest_path).expanduser().resolve()
    if not manifest_path.exists():
        raise SystemExit(f"Manifest not found: {manifest_path}")

    manifest = read_json(manifest_path)
    library_root = read_library_root()
    instance = args.project_instance or manifest.get("project_instance") or month_instance()
    series = args.project_series or manifest.get("project_series") or DEFAULT_SERIES
    account_folder = manifest.get("account_folder") or account_folder_name(
        manifest.get("account_name", ""),
        manifest.get("account_handle", ""),
    )

    links = manifest.get("links", [])
    if len(links) < 3:
        raise SystemExit("At least 3 links are required for account research.")

    content_runs: list[dict] = []
    for item in links:
        url = str(item.get("url", "")).strip()
        if not url:
            continue
        platform = str(item.get("platform", "")).strip().lower() or detect_platform(url)
        if platform == "douyin":
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
                    *(
                        ["--api-key", args.api_key]
                        if args.api_key
                        else []
                    ),
                ],
                env=env,
            )
            content_runs.append(result)
            continue
        if platform == "xiaohongshu":
            result = call_script(
                [
                    "python3",
                    str(SCRIPT_DIR / "run_xhs_single_note_analysis.py"),
                    "--note-url",
                    url,
                    "--project-series",
                    series,
                    "--project-instance",
                    instance,
                    "--account-folder",
                    account_folder,
                ]
            )
            content_runs.append(result)
            continue
        raise SystemExit(f"Unsupported platform for url: {url}")

    if not content_runs:
        raise SystemExit("No sample content was processed.")

    content_analyses = [collect_analysis(item) for item in content_runs]
    base_paths = series_paths(library_root, series, instance)
    platform_key = normalize_selected_platform(manifest)
    research_dir = (
        base_paths["asset_base"]
        / "deliverables"
        / "account-research"
        / platform_key
        / account_folder
    )
    knowledge_ref_dir = (
        base_paths["knowledge_base"]
        / "references"
        / platform_key
        / account_folder
    )
    knowledge_index_dir = (
        base_paths["knowledge_base"]
        / "indexes"
        / platform_key
        / account_folder
    )

    output_paths = {
        "account_research_bundle": research_dir / "account_research_bundle.json",
        "knowledge_reference": knowledge_ref_dir / "账号研究索引__runtime.md",
        "knowledge_index": knowledge_index_dir / "账号研究索引__runtime.md",
    }

    bundle = build_bundle(manifest, content_analyses, content_runs, output_paths)
    write_json(output_paths["account_research_bundle"], bundle)
    knowledge_summary = build_account_report_md(
        bundle,
        "账号研究索引",
        [
            f"研究包：{output_paths['account_research_bundle']}",
            "说明：旧的浅层账号打法报告/模仿策略卡已退役，后续请直接使用单视频 Gemini 深拆报告和账号分析包。",
        ],
    )
    write_text(output_paths["knowledge_reference"], knowledge_summary)
    write_text(output_paths["knowledge_index"], knowledge_summary)

    print(
        json.dumps(
            {
                "success": True,
                "platform": platform_key,
                "account_name": manifest.get("account_name", ""),
                "account_handle": manifest.get("account_handle", ""),
                "project_series": series,
                "project_instance": instance,
                "sample_manifest": str(manifest_path),
                "account_research_bundle": str(output_paths["account_research_bundle"]),
                "knowledge_reference": str(output_paths["knowledge_reference"]),
                "execution_summary": f"已完成 {manifest.get('account_name', '目标账号')} 的 raw 研究包整理，未再生成旧的浅层汇总卡片。",
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
