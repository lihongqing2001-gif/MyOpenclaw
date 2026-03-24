import argparse
import json
import os
import subprocess
from pathlib import Path

from _short_video_factory import (
    DEFAULT_INSPIRATION_INSTANCE_SUFFIX,
    DEFAULT_SERIES,
    detect_platform,
    month_instance,
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
        raise SystemExit(process.stderr or process.stdout or "saved video insight capture failed")
    return json.loads(process.stdout)


def build_direction_prompts(analysis: dict) -> list[str]:
    prompts = []
    hook = analysis.get("hook") or analysis.get("title") or ""
    if hook:
        prompts.append(f"如果沿用这个钩子结构，你可以把什么主题换成你自己的真实经验？")
    structure = analysis.get("structure") or analysis.get("structure_judgement") or ""
    if structure:
        prompts.append(f"这个结构里，哪一段最适合变成你的稳定表达模板：{structure}")
    for item in (analysis.get("reusable_elements") or analysis.get("reusable_angles") or [])[:3]:
        prompts.append(f"围绕“{item}”，你还能延展出哪 3 条自己的选题？")
    return prompts[:5] or ["这条视频最值得你借走的不是结论，而是节奏、钩子还是镜头表达？"]


def build_followup_questions(analysis: dict) -> list[str]:
    title = analysis.get("title") or analysis.get("content_id") or "这条内容"
    return [
        f"{title} 的核心钩子为什么有效？",
        f"{title} 适合模仿的是主题、结构、情绪还是镜头？",
        f"如果把 {title} 改成适合我来讲，应该怎么重写？",
        f"{title} 能为我打开哪些新的选题方向？",
    ]


def build_insight_markdown(
    analysis: dict,
    objective: str,
    reflection_note: str,
    linked_assets: dict[str, str],
) -> str:
    reusable = analysis.get("reusable_elements") or analysis.get("reusable_angles") or []
    direction_prompts = build_direction_prompts(analysis)
    followup_questions = build_followup_questions(analysis)
    return f"""---
id: saved-video-insight-{analysis.get('content_id') or analysis.get('feed_id') or 'item'}
type: case
evidence: runtime
knowledge_type: case-study
platform: {analysis.get('platform', 'unknown')}
updated_at: {analysis.get('generated_at', '')}
---

# 收藏视频洞察

## 基本信息

- 标题：{analysis.get('title', '')}
- 平台：{analysis.get('platform', '')}
- 内容 ID：{analysis.get('content_id', '') or analysis.get('feed_id', '')}
- 目标：{objective}

## 为什么值得收藏

- 钩子：{analysis.get('hook', analysis.get('title', ''))}
- 开头策略：{analysis.get('opening_strategy', analysis.get('hook_judgement', ''))}
- 结构判断：{analysis.get('structure', analysis.get('structure_judgement', ''))}

## 给我的启发

""" + "\n".join(f"- {item}" for item in reusable[:5]) + f"""

## 方向引导

""" + "\n".join(f"- {item}" for item in direction_prompts) + f"""

## 可继续追问

""" + "\n".join(f"- {item}" for item in followup_questions) + f"""

## 我的备注

{reflection_note or '暂无个人备注'}

## 关联资产

- 分析报告：{linked_assets.get('analysis_report', '')}
- 标准分析 JSON：{linked_assets.get('analysis_json', '')}
- 转写：{linked_assets.get('transcript_asset', '')}
- 原始视频：{linked_assets.get('video_asset', '')}
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--video-url", required=True)
    parser.add_argument("--objective", default="把收藏视频沉淀成可阅读、可检索、可继续提问的洞察记录")
    parser.add_argument("--reflection-note", default="")
    parser.add_argument("--collection-name", default="收藏视频")
    parser.add_argument("--project-series", default=DEFAULT_SERIES)
    parser.add_argument("--project-instance", default="")
    parser.add_argument("--api-key", default=os.getenv("API_KEY", ""))
    args = parser.parse_args()

    platform = detect_platform(args.video_url)
    if platform not in {"douyin", "xiaohongshu"}:
        raise SystemExit(f"Unsupported platform for saved insight capture: {args.video_url}")

    instance = args.project_instance or month_instance(DEFAULT_INSPIRATION_INSTANCE_SUFFIX)
    library_root = read_library_root()
    collection_folder = sanitize_segment(args.collection_name, "收藏视频")

    if platform == "douyin":
      env = os.environ.copy()
      if args.api_key:
          env["API_KEY"] = args.api_key
      summary = call_script(
          [
              "python3",
              str(SCRIPT_DIR / "run_douyin_single_video_analysis.py"),
              "--video-url",
              args.video_url,
              "--project-series",
              args.project_series,
              "--project-instance",
              instance,
              "--account-folder",
              collection_folder,
              *(["--api-key", args.api_key] if args.api_key else []),
          ],
          env=env,
      )
    else:
      summary = call_script(
          [
              "python3",
              str(SCRIPT_DIR / "run_xhs_single_note_analysis.py"),
              "--note-url",
              args.video_url,
              "--project-series",
              args.project_series,
              "--project-instance",
              instance,
              "--account-folder",
              collection_folder,
          ]
      )

    analysis_json_path = summary.get("analysis_json")
    if not analysis_json_path or not Path(analysis_json_path).exists():
        raise SystemExit("analysis_json was not created by the source analysis script")

    analysis = read_json(Path(analysis_json_path))
    content_id = analysis.get("content_id") or analysis.get("feed_id") or sanitize_segment(Path(analysis_json_path).stem, "content")
    base_paths = series_paths(library_root, args.project_series, instance)
    insight_asset_dir = (
        base_paths["asset_base"]
        / "deliverables"
        / "inspiration"
        / platform
        / collection_folder
        / content_id
    )
    insight_knowledge_dir = (
        base_paths["knowledge_base"]
        / "cases"
        / "inspiration"
        / platform
        / collection_folder
        / content_id
    )

    insight_bundle_path = insight_asset_dir / "insight_bundle.json"
    insight_md_path = insight_asset_dir / "洞察记录__runtime.md"
    insight_case_path = insight_knowledge_dir / "收藏视频洞察__runtime.md"

    linked_assets = {
        "analysis_report": summary.get("analysis_report", ""),
        "analysis_json": summary.get("analysis_json", ""),
        "transcript_asset": summary.get("transcript_asset", ""),
        "video_asset": summary.get("video_asset", ""),
    }
    insight_bundle = {
        "platform": platform,
        "collection_name": args.collection_name,
        "objective": args.objective,
        "reflection_note": args.reflection_note,
        "analysis": analysis,
        "linked_assets": linked_assets,
    }
    write_json(insight_bundle_path, insight_bundle)
    markdown = build_insight_markdown(analysis, args.objective, args.reflection_note, linked_assets)
    write_text(insight_md_path, markdown)
    write_text(insight_case_path, markdown)

    print(
        json.dumps(
            {
                "success": True,
                "platform": platform,
                "project_series": args.project_series,
                "project_instance": instance,
                "insight_bundle": str(insight_bundle_path),
                "insight_record": str(insight_md_path),
                "knowledge_case": str(insight_case_path),
                "analysis_report": linked_assets["analysis_report"],
                "execution_summary": f"已把收藏视频沉淀为洞察记录：{analysis.get('title', content_id)}",
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
