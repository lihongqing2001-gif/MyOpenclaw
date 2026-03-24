import argparse
import json
from pathlib import Path

from _short_video_factory import read_json, sanitize_segment, write_json, write_text


def select_contents(bundle: dict, selected_ids: list[str]) -> list[dict]:
    contents = bundle.get("source_contents", [])
    if not selected_ids:
        return contents[:1]
    selected = [item for item in contents if item.get("content_id") in selected_ids]
    return selected or contents[:1]


def build_brief(bundle: dict, selected_contents: list[dict], args: argparse.Namespace, output_path: Path) -> dict:
    strategy = args.imitation_strategy or bundle.get("suggested_imitation_strategy") or "结构模仿"
    must_keep = list(dict.fromkeys(
        (bundle.get("opening_patterns") or [])[:3] +
        (bundle.get("structure_patterns") or [])[:3]
    ))
    must_change = [
        "改为你的真实表达，不直接复刻原账号措辞。",
        "保留节奏和结构，但替换为你的主题与案例。",
        "真人口播负责观点主线，AI 补镜只承担气氛和过场。",
    ]
    primary = selected_contents[0] if selected_contents else {}
    return {
        "source_account": bundle.get("source_account", {}),
        "source_contents": selected_contents,
        "target_platform": args.target_platform,
        "target_goal": args.target_goal,
        "imitation_strategy": strategy,
        "must_keep_patterns": must_keep,
        "must_change_patterns": must_change,
        "human_shoot_segments": [
            {
                "id": "human-hook",
                "purpose": "开头钩子口播",
                "duration_sec": 6,
                "script_focus": primary.get("hook") or "用问题或反差开场",
            },
            {
                "id": "human-core",
                "purpose": "核心观点解释",
                "duration_sec": 18,
                "script_focus": primary.get("structure") or "按三段式讲清观点",
            },
        ],
        "ai_broll_segments": [
            {
                "id": "ai-atmosphere",
                "purpose": "情绪/氛围补镜",
                "duration_sec": 4,
                "visual_focus": "补足情绪场景、关系氛围或抽象概念过场",
            },
            {
                "id": "ai-transition",
                "purpose": "章节转场镜头",
                "duration_sec": 3,
                "visual_focus": "强调节奏切换和关键词落点",
            },
        ],
        "duration_target": args.duration_target,
        "tone": args.tone,
        "created_at": bundle.get("generated_at"),
        "research_bundle_path": str(output_path.parent.parent / "account-research_bundle_placeholder"),
    }


def build_brief_markdown(brief: dict, output_json: Path) -> str:
    return f"""# Creative Brief

## 基本信息

- 目标平台：{brief['target_platform']}
- 目标目标：{brief['target_goal']}
- 模仿策略：{brief['imitation_strategy']}
- 目标时长：{brief['duration_target']} 秒
- 语气：{brief['tone']}

## 必须保留

""" + "\n".join(f"- {item}" for item in brief["must_keep_patterns"]) + """

## 必须改写

""" + "\n".join(f"- {item}" for item in brief["must_change_patterns"]) + """

## 真人口播段

""" + "\n".join(
        f"- {item['purpose']} · {item['duration_sec']}s · {item['script_focus']}" for item in brief["human_shoot_segments"]
    ) + """

## AI 补镜段

""" + "\n".join(
        f"- {item['purpose']} · {item['duration_sec']}s · {item['visual_focus']}" for item in brief["ai_broll_segments"]
    ) + f"""

## Artifact

- JSON：{output_json}
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--research-bundle-path", required=True)
    parser.add_argument("--selected-content-ids", default="")
    parser.add_argument("--target-platform", default="douyin")
    parser.add_argument("--target-goal", default="产出口播优先的短视频创作包")
    parser.add_argument("--imitation-strategy", default="")
    parser.add_argument("--tone", default="真诚、克制、带一点情绪张力")
    parser.add_argument("--duration-target", type=int, default=35)
    args = parser.parse_args()

    bundle_path = Path(args.research_bundle_path).expanduser().resolve()
    if not bundle_path.exists():
        raise SystemExit(f"Research bundle not found: {bundle_path}")

    bundle = read_json(bundle_path)
    selected_ids = [item.strip() for item in args.selected_content_ids.split(",") if item.strip()]
    selected_contents = select_contents(bundle, selected_ids)
    if not selected_contents:
        raise SystemExit("No source contents available for creative brief.")

    source_account = bundle.get("source_account", {})
    account_folder = sanitize_segment(source_account.get("folder") or source_account.get("name") or "account")
    primary_content_id = sanitize_segment(selected_contents[0].get("content_id", "content"))
    production_dir = bundle_path.parents[3] / "production" / args.target_platform / account_folder / primary_content_id
    creative_brief_path = production_dir / "creative_brief.json"
    creative_brief = build_brief(bundle, selected_contents, args, creative_brief_path)
    creative_brief["research_bundle_path"] = str(bundle_path)

    write_json(creative_brief_path, creative_brief)
    brief_markdown_path = production_dir / "creative_brief__draft.md"
    write_text(brief_markdown_path, build_brief_markdown(creative_brief, creative_brief_path))

    print(
        json.dumps(
            {
                "success": True,
                "creative_brief": str(creative_brief_path),
                "creative_brief_markdown": str(brief_markdown_path),
                "selected_content_ids": [item.get("content_id", "") for item in selected_contents],
                "execution_summary": "已根据账号研究结果生成 creative brief，可进入导演与生产链。",
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
