import argparse
import json
import subprocess
from pathlib import Path

from _short_video_factory import (
    derive_deliverable_dir_from_raw_video,
    ensure_dir,
    extract_video_frames,
    read_json,
    scan_ffprobe_duration,
    write_json,
    write_text,
)


GEMINI_SCRIPT = Path("/Users/liumobei/.agents/skills/baoyu-danger-gemini-web/scripts/main.ts")
DEFAULT_MODEL = "gemini-3-flash"


def read_title_from_sidecar(video_path: Path) -> str:
    raw_dir = video_path.parent
    raw_info_path = raw_dir / "raw_video_info.json"
    if raw_info_path.exists():
      payload = read_json(raw_info_path)
      return str((payload.get("video_info") or {}).get("title", "")).strip()

    transcript_path = raw_dir / "transcript.md"
    if transcript_path.exists():
      lines = transcript_path.read_text(encoding="utf-8").splitlines()
      if lines and lines[0].startswith("# "):
        return lines[0][2:].strip()

    return video_path.stem


def build_prompt(title: str, duration: float, extra_instruction: str = "") -> str:
    base = (
        "你是短视频导演与内容拆解专家。"
        "请基于我提供的关键帧、视频标题和时长，对这条视频做细致拆分分析。"
        f"已知信息：标题是“{title}”；时长约{duration:.1f}秒。"
        "当前没有可靠语音逐字稿时，涉及口播内容时必须明确标注为基于标题与画面推断，不要假装听到了完整文案。"
        "请输出中文 Markdown，必须包含以下部分："
        "A. 一句话总判断；"
        "B. 内容定位与目标受众；"
        "C. 开头钩子拆解；"
        "D. 结构分段拆解（按可能的内容段落拆成5到8段，每段写目标、可能讲了什么、画面承担什么作用、对留存的作用）；"
        "E. 视觉表达拆解（景别、字幕、人物状态、屏幕录制、信息密度、镜头变化）；"
        "F. 剪辑节奏与时长策略；"
        "G. 这条内容最强的3个可迁移打法；"
        "H. 直接模仿的风险点；"
        "I. 如果我想做同主题但不是照抄，给我3个改写方向；"
        "J. 给这条视频生成一个导演级复刻提纲，包含开头、主体、转场、结尾；"
        "K. 明确列出哪些判断是高置信度视觉判断，哪些只是中低置信度推断。"
        "要求：写得细，不空话，不泛泛而谈，不要只重复标题。"
    )
    if extra_instruction.strip():
        base += f"附加要求：{extra_instruction.strip()}"
    return base


def call_gemini(prompt: str, frame_paths: list[Path], model: str) -> dict:
    command = [
        "bun",
        str(GEMINI_SCRIPT),
        "--json",
        "--model",
        model,
        "--prompt",
        prompt,
        "--reference",
        *[str(path) for path in frame_paths],
    ]
    process = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=300,
    )
    if process.returncode != 0:
        raise SystemExit(process.stderr or process.stdout or "Gemini enhanced analysis failed")
    return json.loads(process.stdout)


def write_markdown_report(
    output_path: Path,
    gemini_payload: dict,
    raw_json_path: Path,
    frame_manifest_path: Path,
    video_path: Path,
) -> None:
    body = str(gemini_payload.get("text", "")).strip()
    report = f"""# 抖音单条视频 Gemini 增强分析报告

## 基本说明

- 分析方式：Gemini Web + 关键帧增强分析
- 模型：`{gemini_payload.get('model', DEFAULT_MODEL)}`
- 原始视频：`{video_path}`
- 关键帧清单：`{frame_manifest_path}`
- Gemini 原始返回：`{raw_json_path}`

## 分析正文

{body}
"""
    write_text(output_path, report)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--video-path", required=True)
    parser.add_argument("--title", default="")
    parser.add_argument("--output-dir", default="")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--frame-count", type=int, default=8)
    parser.add_argument("--extra-instruction", default="")
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
    frames_dir = ensure_dir(output_dir / "gemini_frames")
    frame_manifest = extract_video_frames(video_path, frames_dir, count=max(3, args.frame_count))
    frame_paths = [Path(item["path"]) for item in frame_manifest.get("frames", []) if item.get("path")]
    if not frame_paths:
        raise SystemExit("No frames were extracted for Gemini enhanced analysis")

    duration = scan_ffprobe_duration(video_path)
    title = args.title.strip() or read_title_from_sidecar(video_path)
    prompt = build_prompt(title, duration, args.extra_instruction)
    gemini_payload = call_gemini(prompt, frame_paths, args.model)

    raw_json_path = output_dir / "gemini_video_analysis_raw.json"
    frame_manifest_path = frames_dir / "frame_manifest.json"
    report_path = output_dir / "分析报告__gemini增强__runtime.md"
    prompt_path = output_dir / "gemini_analysis_prompt.txt"

    write_json(raw_json_path, gemini_payload)
    write_json(frame_manifest_path, frame_manifest)
    write_text(prompt_path, prompt)
    write_markdown_report(report_path, gemini_payload, raw_json_path, frame_manifest_path, video_path)

    print(
        json.dumps(
            {
                "success": True,
                "video_path": str(video_path),
                "output_dir": str(output_dir),
                "report_path": str(report_path),
                "raw_json_path": str(raw_json_path),
                "frame_manifest_path": str(frame_manifest_path),
                "prompt_path": str(prompt_path),
                "execution_summary": f"已完成 {video_path.name} 的 Gemini 增强分析并写入交付目录。",
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
