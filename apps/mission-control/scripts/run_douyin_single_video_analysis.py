import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _short_video_factory import (
    extract_video_frames,
    month_instance as factory_month_instance,
    sanitize_segment,
)


WORKSPACE_ROOT = Path("/Users/liumobei/.openclaw/workspace")
DOUYIN_SKILL_ROOT = Path("/Users/liumobei/.agents/skills/douyin-video")
DOUYIN_SKILL_PYTHON = DOUYIN_SKILL_ROOT / ".venv" / "bin" / "python"
DOUYIN_SCRIPT_PATH = DOUYIN_SKILL_ROOT / "scripts" / "douyin_downloader.py"
CONFIG_PATH = WORKSPACE_ROOT / "agents" / "runtime" / "agent-os-config-v1.json"
DEFAULT_SERIES = "AI内容系统"
DEFAULT_INSTANCE_SUFFIX = "单条内容分析"


def now_iso() -> str:
    return datetime.now().astimezone().isoformat()


def month_instance() -> str:
    return factory_month_instance(DEFAULT_INSTANCE_SUFFIX)


def read_library_root() -> Path:
    if not CONFIG_PATH.exists():
        raise SystemExit(f"Library config not found: {CONFIG_PATH}")
    payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    root = payload.get("assetRootPath")
    if not root:
        raise SystemExit("assetRootPath missing in agent-os-config-v1.json")
    library_root = Path(root).expanduser().resolve()
    if not library_root.exists():
        raise SystemExit(f"Configured library root does not exist: {library_root}")
    return library_root


def ensure_skill_ready() -> None:
    if not DOUYIN_SKILL_ROOT.exists():
        raise SystemExit(f"douyin-video skill not found: {DOUYIN_SKILL_ROOT}")
    if not DOUYIN_SKILL_PYTHON.exists():
        raise SystemExit(f"douyin-video python not found: {DOUYIN_SKILL_PYTHON}")
    if not DOUYIN_SCRIPT_PATH.exists():
        raise SystemExit(f"douyin-video script not found: {DOUYIN_SCRIPT_PATH}")


def run_skill_snippet(code: str, link: str, env: dict[str, str]) -> dict:
    process = subprocess.run(
        [str(DOUYIN_SKILL_PYTHON), "-c", code, link],
        cwd=DOUYIN_SKILL_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=1200,
    )
    if process.returncode != 0:
        raise SystemExit(process.stderr or process.stdout or "douyin-video skill failed")
    return json.loads(process.stdout)


def fetch_video_info(link: str) -> dict:
    code = """
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path.cwd() / "scripts"))
import douyin_downloader as downloader

info = downloader.get_video_info(sys.argv[1])
print(json.dumps(info, ensure_ascii=False))
"""
    return run_skill_snippet(code, link, os.environ.copy())


def download_video_only(link: str, output_dir: Path) -> dict:
    env = os.environ.copy()
    code = f"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path.cwd() / "scripts"))
import douyin_downloader as downloader

info = downloader.get_video_info(sys.argv[1])
video_path = downloader.download_video(sys.argv[1], output_dir={json.dumps(str(output_dir), ensure_ascii=False)})
print(json.dumps({{"video_info": info, "video_path": str(video_path)}}, ensure_ascii=False))
"""
    return run_skill_snippet(code, link, env)


def extract_text(link: str, api_key: str, output_dir: Path) -> dict:
    env = os.environ.copy()
    env["API_KEY"] = api_key
    code = f"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path.cwd() / "scripts"))
import douyin_downloader as downloader

result = downloader.extract_text(
    sys.argv[1],
    api_key={json.dumps(api_key, ensure_ascii=False)},
    output_dir={json.dumps(str(output_dir), ensure_ascii=False)},
    save_video=True,
    show_progress=False,
)
result["video_info"]["url"] = result["video_info"].get("url", "")
print(json.dumps(result, ensure_ascii=False))
"""
    return run_skill_snippet(code, link, env)


def account_folder_segment(account_folder: str) -> list[str]:
    normalized = sanitize_segment(account_folder, "")
    return [normalized] if normalized else []


def ensure_dirs(library_root: Path, series: str, instance: str, video_id: str, account_folder: str = "") -> dict[str, Path]:
    asset_base = library_root / "assets" / series / instance
    knowledge_base = library_root / "knowledge" / "projects" / series / instance
    account_parts = account_folder_segment(account_folder)
    raw_dir = asset_base.joinpath("raw", "douyin", *account_parts, video_id)
    deliverable_dir = asset_base.joinpath("deliverables", "douyin", *account_parts, video_id)
    case_dir = knowledge_base.joinpath("cases", "douyin", *account_parts, video_id)

    for target in [raw_dir, deliverable_dir, case_dir]:
        target.mkdir(parents=True, exist_ok=True)

    return {
        "raw_dir": raw_dir,
        "deliverable_dir": deliverable_dir,
        "case_dir": case_dir,
    }


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def read_transcript(transcript_path: Path) -> str:
    if not transcript_path.exists():
        return ""
    content = transcript_path.read_text(encoding="utf-8")
    marker = "## 文案内容"
    if marker not in content:
        return content.strip()
    return content.split(marker, 1)[1].strip()


def write_transcript_placeholder(transcript_path: Path, info: dict, reason: str) -> None:
    transcript_path.write_text(
        "\n".join(
            [
                f"# {info.get('title', 'Douyin Video')}",
                "",
                "| 属性 | 值 |",
                "|------|----|",
                f"| 视频ID | `{info.get('video_id', '')}` |",
                f"| 提取时间 | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} |",
                f"| 下载链接 | [点击下载]({info.get('url', '')}) |",
                "",
                "---",
                "",
                "## 文案内容",
                "",
                f"[转写不可用] {reason}",
                "",
            ]
        ),
        encoding="utf-8",
    )


def summarize_content_form(title: str, transcript_text: str) -> str:
    joined = f"{title}\n{transcript_text}"
    if any(token in joined for token in ["爱", "妻", "老公", "婚姻", "爱情"]):
        return "情感关系类短视频"
    if any(token in joined for token in ["教程", "步骤", "怎么", "方法", "助手", "NotebookLM", "自媒体", "打造爆款"]):
        return "教程建议类短视频"
    if any(token in joined for token in ["观点", "如果", "为什么", "你会"]):
        return "观点表达类短视频"
    return "生活表达类短视频"


def summarize_hook(title: str, transcript_text: str) -> str:
    if "如果你可以" in transcript_text:
        return "先抛问题句，再切入情绪或关系表达"
    if "?" in title or "？" in title:
        return "问题式开头，适合拉高停留"
    if "#" in title:
        return "标签先行的情绪化标题"
    return "直接主题式开头"


def reusable_angles(title: str, transcript_text: str) -> list[str]:
    angles = []
    joined = f"{title}{transcript_text}"
    if any(token in joined for token in ["爱", "妻", "爱情"]):
        angles.append("围绕亲密关系做情绪共鸣型短视频拆解")
        angles.append("把一句核心关系观点扩写成系列短视频脚本")
    if any(token in joined for token in ["NotebookLM", "自媒体", "助手", "爆款"]):
        angles.append("提炼 AI 工具类短视频的标题承诺与结果导向结构")
        angles.append("拆解工具展示、场景收益、行动号召的标准脚本骨架")
    angles.append("拆出标题钩子、口播正文、结尾情绪落点三个层次")
    angles.append("沉淀为后续选题库、文案库和表达风格案例")
    return angles


def build_analysis(
    link: str,
    objective: str,
    info: dict,
    transcript_text: str,
    transcript_path: Path,
    video_path: Path,
    transcript_status: str,
    transcript_error: str,
) -> dict:
    title = info.get("title", "").strip()
    return {
        "platform": "douyin",
        "account": info.get("author", {}).get("name", ""),
        "video_id": info.get("video_id", ""),
        "content_id": info.get("video_id", ""),
        "original_url": link,
        "source_url": link,
        "resolved_video_url": info.get("url", ""),
        "objective": objective,
        "title": title,
        "hook": title,
        "opening_strategy": summarize_hook(title, transcript_text),
        "content_type": "short-video",
        "transcript_excerpt": transcript_text[:200],
        "transcript_length": len(transcript_text),
        "transcript_status": transcript_status,
        "transcript_error": transcript_error,
        "content_form_judgement": summarize_content_form(title, transcript_text),
        "hook_judgement": summarize_hook(title, transcript_text),
        "structure": "问题/情绪钩子 -> 情绪表达 -> 关系落点",
        "audience_judgement": "对 AI 内容生产、自媒体提效和短视频表达感兴趣的人群",
        "emotion_triggers": ["关系", "情绪", "问题句开头"],
        "visual_patterns": ["竖屏口播/表演", "情绪氛围补镜", "关系主题标题"],
        "script_patterns": reusable_angles(title, transcript_text),
        "reusable_angles": reusable_angles(title, transcript_text),
        "cta_pattern": "用情绪问题句引发代入或评论互动",
        "reusable_elements": reusable_angles(title, transcript_text),
        "avoid_copy_elements": [
            "不要逐句模仿原口播。",
            "保留情绪结构，但换成你的案例和表达。",
        ],
        "generated_at": now_iso(),
        "transcript_path": str(transcript_path),
        "video_path": str(video_path),
    }


def build_report_md(analysis: dict, series: str, instance: str, raw_info_path: Path, case_path: Path) -> str:
    excerpt = analysis["transcript_excerpt"] or "无可用文案"
    transcript_note = analysis["transcript_status"]
    if analysis["transcript_error"]:
        transcript_note = f"{transcript_note}（{analysis['transcript_error']}）"
    return f"""# 抖音单条视频分析报告

## 基本信息

- 标题：{analysis['title']}
- 视频 ID：{analysis['content_id']}
- 原始链接：{analysis['original_url']}
- 无水印地址：{analysis['resolved_video_url']}
- 项目系列：{series}
- 项目实例：{instance}

## 内容判断

- 内容形态：{analysis['content_form_judgement']}
- 开头钩子：{analysis['hook_judgement']}
- 受众判断：{analysis['audience_judgement']}
- 转写状态：{transcript_note}
- 文案长度：{analysis['transcript_length']} 字符

## 文案摘录

{excerpt}

## 可复用切入角度

""" + "\n".join(f"- {item}" for item in analysis["reusable_angles"]) + f"""

## 入库路径

- 原始信息：{raw_info_path}
- 转写文案：{analysis['transcript_path']}
- 原始视频：{analysis['video_path']}
- 知识案例：{case_path}
"""


def build_case_md(analysis: dict, series: str, instance: str, report_path: Path, raw_info_path: Path) -> str:
    transcript_note = analysis["transcript_status"]
    if analysis["transcript_error"]:
        transcript_note = f"{transcript_note}（{analysis['transcript_error']}）"
    return f"""---
id: douyin-video-{analysis['content_id']}
type: case
evidence: runtime
knowledge_type: case-study
platform: douyin
project_series: {series}
project_instance: {instance}
updated_at: {analysis['generated_at']}
---

# 抖音单条视频分析案例

## Source

- 原始链接：{analysis['original_url']}
- 标题：{analysis['title']}
- 视频 ID：{analysis['content_id']}

## Core Judgement

- 内容形态：{analysis['content_form_judgement']}
- 开头钩子：{analysis['hook_judgement']}
- 受众判断：{analysis['audience_judgement']}
- 转写状态：{transcript_note}

## Transcript Excerpt

{analysis['transcript_excerpt'] or '无可用文案'}

## Reusable Angles

{chr(10).join(f"- {item}" for item in analysis['reusable_angles'])}

## Linked Assets

- 分析报告：{report_path}
- 原始信息：{raw_info_path}
- 转写文案：{analysis['transcript_path']}
- 原始视频：{analysis['video_path']}
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--video-url", required=True)
    parser.add_argument("--objective", default="拆解抖音视频标题、文案与表达结构并沉淀知识")
    parser.add_argument("--project-series", default=DEFAULT_SERIES)
    parser.add_argument("--project-instance", default="")
    parser.add_argument("--api-key", default=os.getenv("API_KEY", ""))
    parser.add_argument("--account-folder", default="")
    args = parser.parse_args()

    ensure_skill_ready()
    library_root = read_library_root()

    initial_info = fetch_video_info(args.video_url)
    video_id = initial_info.get("video_id", "")
    if not video_id:
        raise SystemExit("Could not resolve Douyin video_id.")

    instance = args.project_instance or month_instance()
    paths = ensure_dirs(library_root, args.project_series, instance, video_id, args.account_folder)

    info = dict(initial_info)
    raw_info_path = paths["raw_dir"] / "raw_video_info.json"
    raw_meta_path = paths["raw_dir"] / "raw_meta.json"
    transcript_path = paths["raw_dir"] / "transcript.md"
    video_path = paths["raw_dir"] / f"{video_id}.mp4"
    frames_dir = paths["raw_dir"] / "frames"
    frames_manifest_path = frames_dir / "frame_manifest.json"
    analysis_json_path = paths["deliverable_dir"] / "analysis.json"
    report_path = paths["deliverable_dir"] / "分析报告__runtime.md"
    case_path = paths["case_dir"] / "单条内容分析__runtime.md"

    transcript_status = "completed"
    transcript_error = ""
    skill_output_path = ""

    if args.api_key:
        extract_result = extract_text(args.video_url, args.api_key, paths["raw_dir"].parent)
        info = extract_result.get("video_info") or initial_info
        skill_output_path = extract_result.get("output_path", "")
        transcript_text = extract_result.get("text", "").strip() or read_transcript(transcript_path)
    else:
        download_result = download_video_only(args.video_url, paths["raw_dir"])
        info = download_result.get("video_info") or initial_info
        transcript_status = "skipped"
        transcript_error = "missing API_KEY"
        transcript_text = ""
        write_transcript_placeholder(transcript_path, info, "未提供 API_KEY，已保留原始视频与基础信息，待补充密钥后可重新转写。")
        downloaded_path = Path(download_result["video_path"])
        if downloaded_path != video_path and downloaded_path.exists():
            downloaded_path.replace(video_path)

    analysis = build_analysis(
        args.video_url,
        args.objective,
        info,
        transcript_text,
        transcript_path,
        video_path,
        transcript_status,
        transcript_error,
    )

    raw_payload = {
        "video_info": info,
        "transcript_text": transcript_text,
        "transcript_status": transcript_status,
        "transcript_error": transcript_error,
        "skill_output_path": skill_output_path,
        "generated_at": analysis["generated_at"],
    }

    write_json(raw_info_path, raw_payload)
    write_json(
        raw_meta_path,
        {
            "platform": "douyin",
            "video_id": video_id,
            "source_url": args.video_url,
            "title": analysis["title"],
            "generated_at": analysis["generated_at"],
        },
    )
    write_json(frames_manifest_path, extract_video_frames(video_path, frames_dir))
    analysis["evidence_refs"] = [
        str(raw_meta_path),
        str(report_path),
        str(transcript_path),
        str(frames_manifest_path),
    ]
    write_json(analysis_json_path, analysis)
    report_path.write_text(
        build_report_md(analysis, args.project_series, instance, raw_info_path, case_path),
        encoding="utf-8",
    )
    case_path.write_text(
        build_case_md(analysis, args.project_series, instance, report_path, raw_info_path),
        encoding="utf-8",
    )

    success = transcript_status == "completed"
    execution_summary = f"已完成《{analysis['title']}》的抖音单条视频分析，并同步写入长期知识库与资产库。"
    if not success:
        execution_summary = (
            f"已完成《{analysis['title']}》的基础入库并保存原始视频，但因缺少 API_KEY 跳过转写；"
            "补充密钥后可重新运行获取完整文案。"
        )

    summary = {
        "success": success,
        "platform": "douyin",
        "video_id": video_id,
        "project_series": args.project_series,
        "project_instance": instance,
        "transcription_completed": success,
        "knowledge_case": str(case_path),
        "analysis_report": str(report_path),
        "raw_payload": str(raw_info_path),
        "raw_meta": str(raw_meta_path),
        "transcript_asset": str(transcript_path),
        "video_asset": str(video_path),
        "frames_manifest": str(frames_manifest_path),
        "analysis_json": str(analysis_json_path),
        "primary_artifact": str(report_path),
        "execution_summary": execution_summary,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
