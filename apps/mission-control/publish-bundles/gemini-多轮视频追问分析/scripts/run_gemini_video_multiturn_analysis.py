import argparse
import json
import os
import shutil
import subprocess
from pathlib import Path

from _short_video_factory import (
    derive_deliverable_dir_from_raw_video,
    ensure_dir,
    extract_audio_from_video,
    generate_session_id,
    read_json,
    read_transcript_text,
    scan_ffprobe_duration,
    write_json,
    write_text,
)


GEMINI_SCRIPT = Path("/Users/liumobei/.agents/skills/baoyu-danger-gemini-web/scripts/main.ts")
TRANSCRIBE_SCRIPT = Path("/Users/liumobei/.codex/skills/transcribe/scripts/transcribe_diarize.py")
DEFAULT_MODEL = "gemini-3-pro"
DEFAULT_ROUNDS_PROFILE = "deep-video-analysis-v1"
TRANSCRIPT_PROMPT_CHAR_LIMIT = 3000


def read_title_from_sidecar(video_path: Path) -> str:
    raw_info_path = video_path.parent / "raw_video_info.json"
    if raw_info_path.exists():
        payload = read_json(raw_info_path)
        return str((payload.get("video_info") or {}).get("title", "")).strip()
    return video_path.stem


def derive_transcript_path(video_path: Path, output_dir: Path, explicit_path: str) -> Path | None:
    if explicit_path.strip():
        return Path(explicit_path).expanduser().resolve()

    sibling_candidates = [
        video_path.parent / "transcript.txt",
        video_path.parent / "transcript.md",
    ]
    for candidate in sibling_candidates:
        if candidate.exists():
            return candidate

    output_candidates = [
        output_dir / "transcript.txt",
        output_dir / "transcript.md",
    ]
    for candidate in output_candidates:
        if candidate.exists():
            return candidate

    return None


def transcribe_video(video_path: Path, output_dir: Path) -> tuple[str, Path | None, str | None]:
    if not TRANSCRIBE_SCRIPT.exists():
        return "", None, "transcribe CLI not found"
    if not os.getenv("OPENAI_API_KEY"):
        return "", None, "OPENAI_API_KEY is not set"

    audio_path = output_dir / "transcript_audio.mp3"
    transcript_path = output_dir / "transcript.txt"
    extract_audio_from_video(video_path, audio_path)

    process = subprocess.run(
        [
            "python3",
            str(TRANSCRIBE_SCRIPT),
            str(audio_path),
            "--response-format",
            "text",
            "--out",
            str(transcript_path),
        ],
        capture_output=True,
        text=True,
        timeout=900,
    )
    if process.returncode != 0 or not transcript_path.exists():
        return "", transcript_path if transcript_path.exists() else None, process.stderr.strip() or process.stdout.strip() or "transcription failed"

    return transcript_path.read_text(encoding="utf-8").strip(), transcript_path, None


def prepare_transcript(video_path: Path, output_dir: Path, explicit_path: str, should_transcribe: bool) -> dict:
    transcript_path = derive_transcript_path(video_path, output_dir, explicit_path)
    if transcript_path and transcript_path.exists():
        text = read_transcript_text(transcript_path)
        if text:
            normalized_path = output_dir / f"transcript{transcript_path.suffix.lower() or '.txt'}"
            if transcript_path.resolve() != normalized_path.resolve():
                shutil.copy2(transcript_path, normalized_path)
                transcript_path = normalized_path
            return {
                "status": "provided",
                "path": str(transcript_path),
                "text": text,
                "error": None,
            }

    if not should_transcribe:
        return {
            "status": "missing",
            "path": None,
            "text": "",
            "error": "transcription skipped",
        }

    text, generated_path, error = transcribe_video(video_path, output_dir)
    if text and generated_path:
        return {
            "status": "generated",
            "path": str(generated_path),
            "text": text,
            "error": None,
        }

    return {
        "status": "failed",
        "path": str(generated_path) if generated_path else None,
        "text": "",
        "error": error or "transcription unavailable",
    }


def truncate_transcript(text: str) -> str:
    cleaned = text.strip()
    if len(cleaned) <= TRANSCRIPT_PROMPT_CHAR_LIMIT:
        return cleaned
    third = max(1, TRANSCRIPT_PROMPT_CHAR_LIMIT // 3)
    middle_start = max(len(cleaned) // 2 - third // 2, 0)
    middle_end = middle_start + third
    head = cleaned[:third]
    middle = cleaned[middle_start:middle_end]
    tail = cleaned[-third:]
    return (
        f"[开头摘录]\n{head}\n\n"
        f"[中段摘录]\n{middle}\n\n"
        f"[结尾摘录]\n{tail}\n\n"
        "[Transcript condensed for prompt length]"
    )


def transcript_context_block(transcript: dict) -> str:
    if transcript["status"] in {"provided", "generated"} and transcript["text"]:
        return (
            "以下是 transcript 摘要证据，请优先把涉及文案、讲解顺序、CTA 的判断建立在这份摘要上：\n\n"
            f"{truncate_transcript(transcript['text'])}"
        )
    return (
        "当前没有可用 transcript 证据。涉及口播文案、讲解顺序、CTA 的判断必须明确标注为中低置信度推断，"
        "不要伪装成已听写的结论。"
    )


def build_round_profiles(title: str, duration: float, transcript: dict) -> dict[str, list[dict[str, str]]]:
    common_context = (
        f"视频标题：{title}\n"
        f"视频时长：约 {duration:.1f} 秒\n"
        "你现在分析的是同一个视频的同一个 Gemini 会话。"
    )
    transcript_context = transcript_context_block(transcript)
    deep_rounds = [
        {
            "id": "round-01-visual-directing",
            "title": "视觉与导演分析",
            "file_name": "分析报告__gemini多轮增强__runtime.md",
            "prompt": (
                f"{common_context}\n\n"
                "这是第一轮。你会直接看到整段视频。"
                "请只从导演与视觉层面深拆，不要重点讲文案。"
                "请输出：一句话总判断、内容定位与受众、镜头组织、录屏/真人/字幕/图示比例、"
                "光影/构图/界面组织、转场方式、节奏推进、信息密度变化、哪些画面承担说服作用、"
                "哪些判断是高置信度视觉事实，哪些只是推断。"
            ),
        },
        {
            "id": "round-02-copy-structure",
            "title": "文案与讲解分析",
            "file_name": "文案与讲解分析__runtime.md",
            "prompt": (
                f"{transcript_context}\n\n"
                "这是第二轮。继续基于同一个视频和同一个上下文，专门分析文案与讲解过程。"
                "请输出：开头钩子、标题与口播关系、讲解推进顺序、知识点铺陈方式、CTA、"
                "哪些判断来自 transcript 摘要，哪些只是推断，不要把没有证据的内容写得像逐字听写。"
            ),
        },
        {
            "id": "round-03-replication",
            "title": "节奏、转场与复刻建议",
            "file_name": "导演复刻建议__runtime.md",
            "prompt": (
                "这是第三轮。继续在同一会话里，综合分析节奏、留存点、转场方法，并输出最终的复刻建议。"
                "请给：分段时长判断、留存点、录屏与讲解切换逻辑、3 个可迁移打法、"
                "直接模仿风险、3 个改写方向、导演级复刻提纲。"
            ),
        },
    ]
    fast_rounds = [
        {
            "id": "round-01-overview",
            "title": "总览与定位",
            "file_name": "分析报告__gemini多轮增强__runtime.md",
            "prompt": (
                f"{common_context}\n\n{transcript_context}\n\n"
                "请快速概括视频主题、受众、结构骨架和主要价值。"
            ),
        },
        {
            "id": "round-02-copy",
            "title": "文案与讲解分析",
            "file_name": "文案与讲解分析__runtime.md",
            "prompt": "请快速分析开头钩子、讲解顺序、CTA 和可迁移打法。",
        },
        {
            "id": "round-03-rhythm",
            "title": "节奏与转场分析",
            "file_name": "节奏与转场分析__runtime.md",
            "prompt": "请快速分析分段时长、留存点、镜头变化和转场方法。",
        },
    ]
    return {
        "deep-video-analysis-v1": deep_rounds,
        "fast-video-analysis-v1": fast_rounds,
    }


def call_gemini(prompt: str, model: str, session_id: str, reference_files: list[Path] | None = None) -> dict:
    command = [
        "bun",
        str(GEMINI_SCRIPT),
        "--json",
        "--model",
        model,
        "--sessionId",
        session_id,
        "--prompt",
        prompt,
    ]
    if reference_files:
        command.extend(["--reference", *[str(path) for path in reference_files]])
    process = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=1200,
    )
    if process.returncode != 0:
        raise SystemExit(process.stderr or process.stdout or "Gemini multi-turn analysis failed")
    return json.loads(process.stdout)


def build_main_report(
    title: str,
    session_id: str,
    rounds: list[dict],
    model: str,
    video_path: Path,
    transcript: dict,
    child_reports: list[Path],
) -> str:
    lines = [
        "# Gemini Pro 多轮深度视频分析总报告",
        "",
        "## 基本信息",
        "",
        f"- 标题：{title}",
        f"- 会话 ID：`{session_id}`",
        f"- 模型：`{model}`",
        f"- 视频：`{video_path}`",
        f"- Transcript 状态：`{transcript['status']}`",
    ]
    if transcript.get("path"):
        lines.append(f"- Transcript 文件：`{transcript['path']}`")
    if transcript.get("error"):
        lines.append(f"- Transcript 备注：{transcript['error']}")

    lines.extend(
        [
            "",
            "## 子报告",
            "",
        ]
    )
    for report in child_reports:
        lines.append(f"- `{report.name}`")

    overview_round = next((item for item in rounds if item["id"].startswith("round-01")), None)
    if overview_round:
        lines.extend(
            [
                "",
                "## 总览正文",
                "",
                overview_round["response"].strip(),
            ]
        )

    lines.extend(
        [
            "",
            "## 轮次索引",
            "",
        ]
    )
    for item in rounds:
        lines.append(f"- {item['id']} · {item['title']}")
    return "\n".join(lines) + "\n"


def write_child_reports(output_dir: Path, rounds: list[dict]) -> list[Path]:
    generated: list[Path] = []
    grouped: dict[str, list[dict]] = {}
    for item in rounds:
        grouped.setdefault(item["file_name"], []).append(item)

    for file_name, items in grouped.items():
        target = output_dir / file_name
        blocks = [f"# {items[0]['title'] if len(items) == 1 else file_name.replace('__runtime.md', '')}", ""]
        for item in items:
            blocks.extend(
                [
                    f"## {item['title']}",
                    "",
                    "### Prompt",
                    "",
                    item["prompt"],
                    "",
                    "### Response",
                    "",
                    item["response"].strip(),
                    "",
                ]
            )
        write_text(target, "\n".join(blocks))
        generated.append(target)
    return generated


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--video-path", required=True)
    parser.add_argument("--output-dir", default="")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--session-id", default="")
    parser.add_argument("--rounds-json", default="")
    parser.add_argument("--transcript-path", default="")
    parser.add_argument("--rounds-profile", default=DEFAULT_ROUNDS_PROFILE)
    parser.add_argument("--max-rounds", type=int, default=0)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--transcribe", action="store_true")
    group.add_argument("--skip-transcribe", action="store_true")
    args = parser.parse_args()

    video_path = Path(args.video_path).expanduser().resolve()
    if not video_path.exists():
        raise SystemExit(f"Video not found: {video_path}")

    output_dir = (
        Path(args.output_dir).expanduser().resolve()
        if args.output_dir
        else derive_deliverable_dir_from_raw_video(video_path)
    )
    ensure_dir(output_dir)

    should_transcribe = True
    if args.skip_transcribe:
        should_transcribe = False
    elif args.transcribe:
        should_transcribe = True

    transcript = prepare_transcript(video_path, output_dir, args.transcript_path, should_transcribe)
    title = read_title_from_sidecar(video_path)
    duration = scan_ffprobe_duration(video_path)
    session_id = args.session_id.strip() or generate_session_id("gemini-video")

    if args.rounds_json.strip():
        rounds = json.loads(args.rounds_json)
    else:
        profiles = build_round_profiles(title, duration, transcript)
        rounds = profiles.get(args.rounds_profile, profiles[DEFAULT_ROUNDS_PROFILE])

    if args.max_rounds and args.max_rounds > 0:
        rounds = rounds[: args.max_rounds]

    prompt_rounds_path = output_dir / "prompt_rounds.json"
    write_json(
        prompt_rounds_path,
        {
            "rounds_profile": args.rounds_profile,
            "model": args.model,
            "session_id": session_id,
            "rounds": rounds,
        },
    )

    round_outputs: list[dict] = []
    for index, item in enumerate(rounds):
        prompt = str(item.get("prompt", "")).strip()
        if not prompt:
            continue
        payload = call_gemini(
            prompt=prompt,
            model=args.model,
            session_id=session_id,
            reference_files=[Path(path) for path in item.get("reference_files", []) if path] or ([video_path] if index == 0 else None),
        )
        round_outputs.append(
            {
                "id": item.get("id", f"round-{index+1:02d}"),
                "title": item.get("title", item.get("id", f"round-{index+1:02d}")),
                "file_name": item.get("file_name", "分析报告__gemini多轮增强__runtime.md"),
                "prompt": prompt,
                "response": payload.get("text", ""),
                "raw": payload,
            }
        )

    raw_path = output_dir / "gemini_multiturn_video_analysis_raw.json"
    report_path = output_dir / "分析报告__gemini多轮增强__runtime.md"
    summary_path = output_dir / "gemini_multiturn_summary.json"

    write_json(
        raw_path,
        {
            "session_id": session_id,
            "model": args.model,
            "rounds_profile": args.rounds_profile,
            "transcript": transcript,
            "rounds": round_outputs,
        },
    )
    child_reports = write_child_reports(output_dir, round_outputs[1:] if len(round_outputs) > 1 else round_outputs)
    write_text(report_path, build_main_report(title, session_id, round_outputs, args.model, video_path, transcript, child_reports))
    write_json(
        summary_path,
        {
            "session_id": session_id,
            "model": args.model,
            "video_path": str(video_path),
            "round_count": len(round_outputs),
            "rounds_profile": args.rounds_profile,
            "transcript_status": transcript["status"],
            "transcript_path": transcript.get("path"),
        },
    )

    print(
        json.dumps(
            {
                "success": True,
                "session_id": session_id,
                "video_path": str(video_path),
                "output_dir": str(output_dir),
                "report_path": str(report_path),
                "raw_path": str(raw_path),
                "summary_path": str(summary_path),
                "prompt_rounds_path": str(prompt_rounds_path),
                "round_count": len(round_outputs),
                "transcript_status": transcript["status"],
                "transcript_path": transcript.get("path"),
                "child_reports": [str(path) for path in child_reports],
                "execution_summary": f"已完成同一视频在同一 Gemini 会话下的多轮深度分析，共 {len(round_outputs)} 轮。",
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
