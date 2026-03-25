import argparse
import json
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _short_video_factory import (
    build_remote_frame_manifest,
    month_instance as factory_month_instance,
    sanitize_segment,
)


WORKSPACE_ROOT = Path("/Users/liumobei/.openclaw/workspace")
XHS_ROOT = WORKSPACE_ROOT / "skills" / "xiaohongshu-skills"
CONFIG_PATH = WORKSPACE_ROOT / "agents" / "runtime" / "agent-os-config-v1.json"
DEFAULT_SERIES = "AI内容系统"
DEFAULT_INSTANCE_SUFFIX = "单条内容分析"


@dataclass
class ResolvedNote:
    original_url: str
    resolved_url: str
    feed_id: str
    xsec_token: str


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


def resolve_short_url(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.geturl()


def parse_note_url(url: str) -> ResolvedNote:
    resolved = resolve_short_url(url) if "xhslink.com" in url else url
    parsed = urllib.parse.urlparse(resolved)
    query = urllib.parse.parse_qs(parsed.query)

    match = re.search(r"/(?:explore|discovery/item)/([^/?#]+)", parsed.path)
    if not match:
        raise SystemExit(f"Could not extract feed_id from Xiaohongshu URL: {resolved}")

    feed_id = match.group(1)
    xsec_token = query.get("xsec_token", [""])[0]
    if not xsec_token:
        raise SystemExit(f"Could not extract xsec_token from Xiaohongshu URL: {resolved}")

    return ResolvedNote(
        original_url=url,
        resolved_url=resolved,
        feed_id=feed_id,
        xsec_token=xsec_token,
    )


def run_fetch(note: ResolvedNote) -> dict:
    python_bin = XHS_ROOT / ".venv" / "bin" / "python"
    if not python_bin.exists():
        raise SystemExit(f"xiaohongshu-skills python not found: {python_bin}")

    process = subprocess.run(
        [
            str(python_bin),
            "scripts/cli.py",
            "get-feed-detail",
            "--feed-id",
            note.feed_id,
            "--xsec-token",
            note.xsec_token,
            "--max-comment-items",
            "20",
        ],
        cwd=XHS_ROOT,
        capture_output=True,
        text=True,
        timeout=600,
    )
    if process.returncode != 0:
        raise SystemExit(process.stderr or process.stdout or "xiaohongshu fetch failed")
    return json.loads(process.stdout)


def normalize_title(title: str) -> str:
    title = re.sub(r"[\\/:*?\"<>|]+", " ", title).strip()
    title = re.sub(r"\s+", " ", title)
    return title[:40] or "小红书笔记"


def extract_tags(desc: str) -> list[str]:
    return re.findall(r"#([^#\[\]]+)", desc or "")


def flatten_comments(payload: dict) -> list[dict]:
    rows = []
    for comment in payload.get("comments", []):
        rows.append(
            {
                "id": comment.get("id", ""),
                "content": comment.get("content", ""),
                "likeCount": comment.get("likeCount", ""),
                "subCommentCount": comment.get("subCommentCount", ""),
                "ipLocation": comment.get("ipLocation", ""),
                "user": (comment.get("user") or {}).get("nickname", ""),
                "createTime": comment.get("createTime", 0),
            }
        )
        for reply in comment.get("subComments", []) or []:
            rows.append(
                {
                    "id": reply.get("id", ""),
                    "content": reply.get("content", ""),
                    "likeCount": reply.get("likeCount", ""),
                    "subCommentCount": reply.get("subCommentCount", ""),
                    "ipLocation": reply.get("ipLocation", ""),
                    "user": (reply.get("user") or {}).get("nickname", ""),
                    "createTime": reply.get("createTime", 0),
                }
            )
    return rows


def classify_comment_signals(comments: list[dict]) -> dict:
    question = 0
    action = 0
    humor = 0
    confusion = 0

    for row in comments:
        text = row.get("content", "")
        if any(token in text for token in ["？", "?", "请问", "为什么", "正常吗", "什么症状"]):
            question += 1
        if any(token in text for token in ["课代表", "试试", "喝咖啡", "运动", "冷水", "呼吸"]):
            action += 1
        if any(token in text for token in ["笑哭", "捂脸", "哈哈", "我一直以为"]):
            humor += 1
        if any(token in text for token in ["困", "智商", "卡壳", "不正常", "乱"]):
            confusion += 1

    return {
        "question": question,
        "action": action,
        "humor": humor,
        "confusion": confusion,
    }


def top_comments(comments: list[dict], limit: int = 3) -> list[dict]:
    return sorted(
        comments,
        key=lambda item: int(str(item.get("likeCount", "0") or "0")),
        reverse=True,
    )[:limit]


def build_analysis(note: ResolvedNote, payload: dict, objective: str) -> dict:
    note_payload = payload.get("note", {})
    comments = flatten_comments(payload)
    signals = classify_comment_signals(comments)
    tag_list = extract_tags(note_payload.get("desc", ""))

    title = note_payload.get("title", "")
    core_theme = title
    reusable_angles = [
        "把专业脑科学概念拆成具体可执行动作",
        "用单一神经递质做系列化内容切口",
        "从评论区问题里继续延展下一篇选题",
    ]

    return {
        "feed_id": note.feed_id,
        "resolved_url": note.resolved_url,
        "objective": objective,
        "title": title,
        "author": (note_payload.get("user") or {}).get("nickname", ""),
        "type": note_payload.get("type", ""),
        "desc": note_payload.get("desc", ""),
        "tags": tag_list,
        "ip_location": note_payload.get("ipLocation", ""),
        "interactions": note_payload.get("interactInfo", {}),
        "comment_count_loaded": len(comments),
        "comment_signals": signals,
        "top_comments": top_comments(comments),
        "core_theme": core_theme,
        "structure_judgement": "知识解释 + 可执行建议 + 评论区答疑延展",
        "audience_judgement": "关注专注力、脑科学、自我调节的人群",
        "reusable_angles": reusable_angles,
        "generated_at": now_iso(),
    }


def account_folder_segment(account_folder: str) -> list[str]:
    normalized = sanitize_segment(account_folder, "")
    return [normalized] if normalized else []


def ensure_dirs(library_root: Path, series: str, instance: str, feed_id: str, account_folder: str = "") -> dict:
    asset_base = library_root / "assets" / series / instance
    knowledge_base = library_root / "knowledge" / "projects" / series / instance
    account_parts = account_folder_segment(account_folder)
    raw_dir = asset_base.joinpath("raw", "xiaohongshu", *account_parts, feed_id)
    deliverable_dir = asset_base.joinpath("deliverables", "xiaohongshu", *account_parts, feed_id)
    case_dir = knowledge_base.joinpath("cases", "xiaohongshu", *account_parts, feed_id)

    for target in [raw_dir, deliverable_dir, case_dir]:
        target.mkdir(parents=True, exist_ok=True)

    return {
        "raw_dir": raw_dir,
        "deliverable_dir": deliverable_dir,
        "case_dir": case_dir,
    }


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def build_report_md(analysis: dict, series: str, instance: str, raw_path: Path, case_path: Path) -> str:
    interactions = analysis["interactions"]
    top_comment_lines = []
    for item in analysis["top_comments"]:
        top_comment_lines.append(
            f"- {item['user']}：{item['content']}（赞 {item['likeCount']}）"
        )
    top_comment_block = "\n".join(top_comment_lines) or "- 无"

    tag_line = " / ".join(analysis["tags"]) if analysis["tags"] else "无显式标签"

    return f"""# 小红书单条笔记分析报告

## 基本信息

- 标题：{analysis['title']}
- 作者：{analysis['author']}
- 类型：{analysis['type']}
- 解析链接：{analysis['resolved_url']}
- 项目系列：{series}
- 项目实例：{instance}

## 互动概况

- 点赞：{interactions.get('likedCount', '')}
- 收藏：{interactions.get('collectedCount', '')}
- 评论：{interactions.get('commentCount', '')}
- 已加载评论：{analysis['comment_count_loaded']}

## 标签与主题

- 标签：{tag_line}
- 核心主题：{analysis['core_theme']}
- 结构判断：{analysis['structure_judgement']}
- 受众判断：{analysis['audience_judgement']}

## 评论反馈信号

- 提问型评论：{analysis['comment_signals']['question']}
- 行动型评论：{analysis['comment_signals']['action']}
- 幽默/玩梗评论：{analysis['comment_signals']['humor']}
- 困惑/负担型评论：{analysis['comment_signals']['confusion']}

## 代表性评论

{top_comment_block}

## 可复用切入角度

""" + "\n".join(f"- {item}" for item in analysis["reusable_angles"]) + f"""

## 入库路径

- 原始快照：{raw_path}
- 知识案例：{case_path}
"""


def build_case_md(analysis: dict, series: str, instance: str, report_path: Path, raw_path: Path) -> str:
    return f"""---
id: xhs-note-{analysis['feed_id']}
type: case
evidence: runtime
knowledge_type: case-study
platform: xiaohongshu
project_series: {series}
project_instance: {instance}
updated_at: {analysis['generated_at']}
---

# 小红书单条笔记分析案例

## Source

- 原始链接：{analysis['resolved_url']}
- 标题：{analysis['title']}
- 作者：{analysis['author']}

## Core Judgement

- 核心主题：{analysis['core_theme']}
- 结构判断：{analysis['structure_judgement']}
- 受众判断：{analysis['audience_judgement']}

## Comment Signals

```json
{json.dumps(analysis['comment_signals'], ensure_ascii=False, indent=2)}
```

## Reusable Angles

{chr(10).join(f"- {item}" for item in analysis['reusable_angles'])}

## Linked Assets

- 分析报告：{report_path}
- 原始快照：{raw_path}
"""


def collect_visual_urls(note_payload: dict) -> list[str]:
    urls: list[str] = []
    for image in note_payload.get("imageList", []) or []:
        for key in ("urlDefault", "urlPre", "url"):
            value = image.get(key)
            if isinstance(value, str) and value:
                urls.append(value)
                break

    video = note_payload.get("video") or {}
    media = video.get("media") or {}
    stream = media.get("stream") or {}
    if isinstance(stream, dict):
        for codec_items in stream.values():
            if not isinstance(codec_items, list):
                continue
            for item in codec_items:
                url = item.get("masterUrl")
                if isinstance(url, str) and url:
                    urls.append(url)

    return list(dict.fromkeys(urls))


def build_transcript_md(analysis: dict, comments: list[dict]) -> str:
    top_lines = []
    for item in top_comments(comments, limit=5):
        top_lines.append(f"- {item['user']}：{item['content']}")
    top_block = "\n".join(top_lines) or "- 无"
    return f"""# {analysis['title'] or '小红书内容转写'}

## 正文

{analysis['desc'] or '无正文'}

## 代表性评论

{top_block}
"""


def build_standard_analysis(
    analysis: dict,
    raw_meta_path: Path,
    report_path: Path,
    transcript_path: Path,
    frame_manifest_path: Path,
) -> dict:
    return {
        "platform": "xiaohongshu",
        "account": analysis["author"],
        "content_id": analysis["feed_id"],
        "source_url": analysis["resolved_url"],
        "content_type": analysis["type"] or "note",
        "title": analysis["title"],
        "hook": analysis["title"] or analysis["core_theme"],
        "opening_strategy": "标题先行 + 正文解释 + 评论区延展",
        "structure": analysis["structure_judgement"],
        "emotion_triggers": analysis["tags"] or ["知识点", "评论互动"],
        "visual_patterns": ["封面标题表达", "图文/短视频内容卡片", "评论区问题引导"],
        "script_patterns": analysis["reusable_angles"],
        "cta_pattern": "通过评论区问题和收藏需求延展下一条内容",
        "reusable_elements": analysis["reusable_angles"],
        "avoid_copy_elements": [
            "不要直接照搬原作者措辞和案例。",
            "改写为你的主题与表达风格后再进入生产链。",
        ],
        "evidence_refs": [
            str(raw_meta_path),
            str(report_path),
            str(transcript_path),
            str(frame_manifest_path),
        ],
        "original_analysis": analysis,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--note-url", required=True)
    parser.add_argument("--objective", default="拆解观点、结构、评论反馈并沉淀知识")
    parser.add_argument("--project-series", default=DEFAULT_SERIES)
    parser.add_argument("--project-instance", default="")
    parser.add_argument("--account-folder", default="")
    args = parser.parse_args()

    library_root = read_library_root()
    note = parse_note_url(args.note_url)
    payload = run_fetch(note)
    instance = args.project_instance or month_instance()
    paths = ensure_dirs(library_root, args.project_series, instance, note.feed_id, args.account_folder)

    analysis = build_analysis(note, payload, args.objective)
    comments = flatten_comments(payload)
    raw_path = paths["raw_dir"] / "raw_note.json"
    raw_meta_path = paths["raw_dir"] / "raw_meta.json"
    transcript_path = paths["raw_dir"] / "transcript.md"
    frames_dir = paths["raw_dir"] / "frames"
    frame_manifest_path = frames_dir / "frame_manifest.json"
    analysis_json_path = paths["deliverable_dir"] / "analysis.json"
    report_path = paths["deliverable_dir"] / "分析报告__runtime.md"
    case_path = paths["case_dir"] / "单条内容分析__runtime.md"

    write_json(raw_path, payload)
    write_json(
        raw_meta_path,
        {
            "platform": "xiaohongshu",
            "feed_id": note.feed_id,
            "resolved_url": note.resolved_url,
            "title": analysis["title"],
            "author": analysis["author"],
            "type": analysis["type"],
            "generated_at": analysis["generated_at"],
        },
    )
    transcript_path.write_text(build_transcript_md(analysis, comments), encoding="utf-8")
    build_remote_frame_manifest(collect_visual_urls(payload.get("note", {})), frames_dir, note.resolved_url)
    write_json(
        analysis_json_path,
        build_standard_analysis(analysis, raw_meta_path, report_path, transcript_path, frame_manifest_path),
    )
    report_path.write_text(
        build_report_md(analysis, args.project_series, instance, raw_path, case_path),
        encoding="utf-8",
    )
    case_path.write_text(
        build_case_md(analysis, args.project_series, instance, report_path, raw_path),
        encoding="utf-8",
    )

    summary = {
        "success": True,
        "platform": "xiaohongshu",
        "feed_id": note.feed_id,
        "resolved_url": note.resolved_url,
        "project_series": args.project_series,
        "project_instance": instance,
        "knowledge_case": str(case_path),
        "analysis_report": str(report_path),
        "raw_payload": str(raw_path),
        "raw_meta": str(raw_meta_path),
        "transcript_asset": str(transcript_path),
        "frames_manifest": str(frame_manifest_path),
        "analysis_json": str(analysis_json_path),
        "primary_artifact": str(report_path),
        "execution_summary": f"已完成《{analysis['title']}》的小红书单条分析，并同步写入长期知识库与资产库。",
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
