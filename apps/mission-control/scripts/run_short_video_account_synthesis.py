import argparse
import json
import subprocess
from pathlib import Path

from _short_video_factory import DEFAULT_SERIES, account_folder_name, month_instance, read_json, read_library_root, write_json, write_text


GEMINI_SCRIPT = Path("/Users/liumobei/.agents/skills/baoyu-danger-gemini-web/scripts/main.ts")


def call_gemini_with_promptfile(prompt_path: Path, model: str) -> dict:
    process = subprocess.run(
        [
            "bun",
            str(GEMINI_SCRIPT),
            "--json",
            "--model",
            model,
            "--promptfiles",
            str(prompt_path),
        ],
        capture_output=True,
        text=True,
        timeout=1800,
    )
    if process.returncode != 0:
        raise SystemExit(process.stderr or process.stdout or "account synthesis failed")
    return json.loads(process.stdout)


def load_deep_reports(batch_payload: dict) -> list[dict]:
    records = []
    for item in batch_payload.get("results", []):
        report_path = item.get("report_path")
        if not report_path:
            continue
        path = Path(report_path)
        if not path.exists():
            continue
        records.append(
            {
                "content_id": item.get("content_id", ""),
                "title": item.get("title", ""),
                "report_path": report_path,
                "report_text": path.read_text(encoding="utf-8"),
            }
        )
    return records


def scan_deep_reports(output_dir: Path) -> list[dict]:
    records = []
    for report_path in sorted(output_dir.glob("*/分析报告__gemini多轮增强__runtime.md")):
        content_id = report_path.parent.name
        raw_info_path = (
            output_dir.parents[3]
            / "raw"
            / output_dir.parent.name
            / output_dir.name
            / content_id
            / "raw_video_info.json"
        )
        title = content_id
        if raw_info_path.exists():
            try:
                payload = read_json(raw_info_path)
                title = str((payload.get("video_info") or {}).get("title", "")).strip() or content_id
            except Exception:
                title = content_id
        records.append(
            {
                "content_id": content_id,
                "title": title,
                "report_path": str(report_path),
                "report_text": report_path.read_text(encoding="utf-8"),
            }
        )
    return records


def build_prompt(records: list[dict], account_name: str, account_handle: str) -> str:
    blocks = [
        f"你是内容策略和对标研究专家。现在请你根据账号 {account_name}（{account_handle}）的多条单视频深度分析报告，输出一个真正可用的账号分析包。",
        "要求输出中文 Markdown，并至少包含这些章节：",
        "1. 账号定位与人设气质",
        "2. 主题池与内容母题",
        "3. 标题模板库（不要原文堆叠，要抽成模板）",
        "4. 讲解结构模板",
        "5. 节奏与转场风格",
        "6. 视频里的信息组织方法",
        "7. 最值得模仿的 5 个具体打法",
        "8. 不建议照抄的部分",
        "9. 如果要模仿这个账号，给出一份可执行的创作指导",
        "10. 明确指出当前上游 raw / transcript / 深拆链路还存在哪些质量问题",
        "11. 给出链路改进建议，按优先级排序",
        "",
        "不要只重复标题，不要空泛，要抽象成方法论。",
        "",
        "以下是样本深拆报告：",
        "",
    ]
    for index, record in enumerate(records, start=1):
        blocks.extend(
            [
                f"## 样本 {index}",
                f"- content_id: {record['content_id']}",
                f"- title: {record['title']}",
                "",
                record["report_text"][:18000],
                "",
            ]
        )
    return "\n".join(blocks)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest-path", required=True)
    parser.add_argument("--deep-batch-path", default="")
    parser.add_argument("--project-series", default=DEFAULT_SERIES)
    parser.add_argument("--project-instance", default="")
    parser.add_argument("--model", default="gemini-3-pro")
    parser.add_argument("--min-reports", type=int, default=3)
    args = parser.parse_args()

    manifest_path = Path(args.manifest_path).expanduser().resolve()
    if not manifest_path.exists():
        raise SystemExit(f"Manifest not found: {manifest_path}")

    manifest = read_json(manifest_path)
    library_root = read_library_root()
    instance = args.project_instance or manifest.get("project_instance") or month_instance("短视频对标试点")
    series = args.project_series or manifest.get("project_series") or DEFAULT_SERIES
    platform = str(manifest.get("platform", "douyin")).strip().lower() or "douyin"
    account_folder = manifest.get("account_folder") or account_folder_name(
        manifest.get("account_name", ""),
        manifest.get("account_handle", ""),
    )

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

    records = []
    batch_path = Path(args.deep_batch_path).expanduser().resolve() if args.deep_batch_path else None
    if batch_path and batch_path.exists():
        deep_batch = read_json(batch_path)
        records = load_deep_reports(deep_batch)
    if not records:
        records = scan_deep_reports(
            library_root / "assets" / series / instance / "deliverables" / platform / account_folder
        )
    if len(records) < args.min_reports:
        raise SystemExit(f"Only {len(records)} deep reports found; need at least {args.min_reports} to synthesize account package")

    prompt_path = output_dir / "account_synthesis_prompt.txt"
    prompt = build_prompt(records, manifest.get("account_name", ""), manifest.get("account_handle", ""))
    write_text(prompt_path, prompt)
    gemini_payload = call_gemini_with_promptfile(prompt_path, args.model)

    main_report_path = output_dir / "账号分析包__runtime.md"
    raw_path = output_dir / "account_synthesis_raw.json"
    scorecard_path = output_dir / "质量评分卡__runtime.md"
    scorecard_json_path = output_dir / "quality_scorecard.json"

    write_json(raw_path, gemini_payload)
    write_text(main_report_path, gemini_payload.get("text", ""))
    stage_label = "partial" if len(records) < int(manifest.get("sample_size", len(records))) else "full"
    scorecard = {
        "raw_collection": {"status": "completed", "note": "样本已抓取并形成 raw 证据层"},
        "deep_analysis": {"status": "partial" if stage_label == "partial" else "completed", "note": f"已完成 {len(records)} 条单视频深拆"},
        "account_synthesis": {"status": "partial" if stage_label == "partial" else "completed", "note": f"已基于 {len(records)} 条深拆结果生成{stage_label}账号分析包"},
    }
    write_json(scorecard_json_path, scorecard)
    write_text(
        scorecard_path,
        "# 质量评分卡\n\n"
        "- raw_collection: completed\n"
        "- deep_analysis: completed\n"
        "- account_synthesis: completed\n"
        "- 说明：详细的质量问题与改进建议已经包含在 `账号分析包__runtime.md` 中。\n",
    )

    print(
        json.dumps(
            {
                "success": True,
                "report_path": str(main_report_path),
                "raw_path": str(raw_path),
                "scorecard_path": str(scorecard_path),
                "prompt_path": str(prompt_path),
                "report_count": len(records),
                "stage": stage_label,
                "execution_summary": f"已完成 {manifest.get('account_name', '目标账号')} 的{stage_label}账号分析包，基于 {len(records)} 条深拆结果。",
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
