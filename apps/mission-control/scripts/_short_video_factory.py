import csv
import json
import re
import subprocess
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from _workspace_topology import repo_root, runtime_root

WORKSPACE_ROOT = repo_root()
RUNTIME_ROOT = runtime_root()
CONFIG_PATH = RUNTIME_ROOT / "agent" / "agent-os-config-v1.json"
DEFAULT_SERIES = "AI内容系统"
DEFAULT_SHORT_VIDEO_INSTANCE_SUFFIX = "短视频对标试点"
DEFAULT_INSPIRATION_INSTANCE_SUFFIX = "收藏视频洞察"
DEFAULT_TARGET_MODE = "script-first"
DEFAULT_MIN_SAMPLE_SIZE = 3
DEFAULT_SAMPLE_SIZE = 5


def now_iso() -> str:
    return datetime.now().astimezone().isoformat()


def month_instance(suffix: str = DEFAULT_SHORT_VIDEO_INSTANCE_SUFFIX) -> str:
    return f"{datetime.now().astimezone():%Y-%m}__{suffix}"


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


def sanitize_segment(value: str, fallback: str = "untitled") -> str:
    cleaned = re.sub(r"\s+", "_", value.strip())
    cleaned = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff._-]+", "", cleaned)
    cleaned = cleaned.strip("._-")
    return cleaned[:80] or fallback


def account_folder_name(account_name: str, account_handle: str = "") -> str:
    primary = sanitize_segment(account_name or account_handle or "未命名账号", "未命名账号")
    handle = sanitize_segment(account_handle, "")
    if handle and handle != primary:
      return f"{primary}__{handle}"
    return primary


def detect_platform(url: str) -> str:
    lower = url.lower()
    if "douyin.com" in lower or "iesdouyin.com" in lower:
        return "douyin"
    if "xhslink.com" in lower or "xiaohongshu.com" in lower:
        return "xiaohongshu"
    return "unknown"


def ensure_dir(target: Path) -> Path:
    target.mkdir(parents=True, exist_ok=True)
    return target


def write_json(path: Path, payload: Any) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    ensure_dir(path.parent)
    path.write_text(text, encoding="utf-8")


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_links_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["index", "platform", "url", "note"])
        writer.writeheader()
        for idx, row in enumerate(rows, start=1):
            writer.writerow(
                {
                    "index": idx,
                    "platform": row.get("platform", ""),
                    "url": row.get("url", ""),
                    "note": row.get("note", ""),
                }
            )


def platform_dir_key(platform: str) -> str:
    if platform in {"douyin", "xiaohongshu"}:
        return platform
    return "mixed"


def series_paths(library_root: Path, series: str, instance: str) -> dict[str, Path]:
    asset_base = library_root / "assets" / series / instance
    knowledge_base = library_root / "knowledge" / "projects" / series / instance
    return {
        "asset_base": asset_base,
        "knowledge_base": knowledge_base,
    }


def build_intake_dir(
    library_root: Path,
    series: str,
    instance: str,
    platform: str,
    account_folder: str,
    batch_id: str,
) -> Path:
    return (
        series_paths(library_root, series, instance)["asset_base"]
        / "intake"
        / platform_dir_key(platform)
        / account_folder
        / batch_id
    )


def scan_ffprobe_duration(video_path: Path) -> float:
    process = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video_path),
        ],
        capture_output=True,
        text=True,
        timeout=20,
    )
    if process.returncode != 0:
        return 0.0
    try:
        return float(process.stdout.strip())
    except ValueError:
        return 0.0


def extract_video_frames(video_path: Path, frames_dir: Path, count: int = 3) -> dict[str, Any]:
    ensure_dir(frames_dir)
    manifest: dict[str, Any] = {
        "source": str(video_path),
        "mode": "local-video",
        "count": 0,
        "frames": [],
    }
    if not video_path.exists():
        manifest["mode"] = "missing-video"
        return manifest

    duration = max(scan_ffprobe_duration(video_path), 1.0)
    offsets = []
    if count <= 1:
        offsets = [0.0]
    else:
        step = duration / (count + 1)
        offsets = [step * index for index in range(1, count + 1)]

    saved_frames: list[dict[str, Any]] = []
    for index, offset in enumerate(offsets, start=1):
        output_path = frames_dir / f"frame_{index:02d}.jpg"
        process = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-ss",
                f"{offset:.2f}",
                "-i",
                str(video_path),
                "-frames:v",
                "1",
                "-q:v",
                "2",
                str(output_path),
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if process.returncode == 0 and output_path.exists():
            saved_frames.append({"index": index, "offset": round(offset, 2), "path": str(output_path)})

    manifest["count"] = len(saved_frames)
    manifest["frames"] = saved_frames
    return manifest


def build_remote_frame_manifest(urls: list[str], frames_dir: Path, source: str) -> dict[str, Any]:
    ensure_dir(frames_dir)
    manifest = {
        "source": source,
        "mode": "remote-only",
        "count": len(urls),
        "frames": [{"index": index + 1, "url": url} for index, url in enumerate(urls)],
    }
    write_json(frames_dir / "frame_manifest.json", manifest)
    return manifest


def existing_file(path: str | None) -> str | None:
    if not path:
        return None
    target = Path(path)
    return str(target) if target.exists() else None


def derive_deliverable_dir_from_raw_video(video_path: Path) -> Path:
    parts = list(video_path.resolve().parts)
    if "raw" not in parts:
        raise SystemExit(f"Cannot infer deliverable directory from video path: {video_path}")

    raw_index = parts.index("raw")
    root_parts = parts[:raw_index]
    suffix_parts = parts[raw_index + 1 : -1]
    if len(suffix_parts) < 2:
        raise SystemExit(f"Video path is missing platform/content segments: {video_path}")

    deliverable_parts = root_parts + ["deliverables"] + suffix_parts
    return Path(*deliverable_parts)


def generate_session_id(prefix: str = "gemini-video") -> str:
    return f"{prefix}-{datetime.now().astimezone():%Y%m%d%H%M%S}-{uuid.uuid4().hex[:8]}"


def read_transcript_text(transcript_path: Path) -> str:
    if not transcript_path.exists():
        return ""

    content = transcript_path.read_text(encoding="utf-8").strip()
    if not content:
        return ""

    if transcript_path.suffix.lower() == ".md":
        marker = "## 文案内容"
        if marker in content:
            text = content.split(marker, 1)[1].strip()
        else:
            lines = [line.strip() for line in content.splitlines() if line.strip() and not line.startswith("#")]
            text = "\n".join(lines)
    else:
        text = content

    lowered = text.lower()
    if (
        "转写失败" in text
        or "转写不可用" in text
        or "missing api_key" in lowered
        or "未完成语音识别" in text
    ):
        return ""

    return text.strip()


def extract_audio_from_video(video_path: Path, audio_path: Path) -> Path:
    ensure_dir(audio_path.parent)
    process = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-b:a",
            "64k",
            str(audio_path),
        ],
        capture_output=True,
        text=True,
        timeout=300,
    )
    if process.returncode != 0 or not audio_path.exists():
        raise SystemExit(process.stderr or process.stdout or f"Failed to extract audio from {video_path}")
    return audio_path


def extract_representative_clips(
    video_path: Path,
    clips_dir: Path,
    clip_duration: int = 45,
    count: int = 3,
) -> list[dict[str, Any]]:
    ensure_dir(clips_dir)
    duration = max(scan_ffprobe_duration(video_path), float(clip_duration))
    if count <= 1:
        offsets = [0.0]
    else:
        max_start = max(duration - clip_duration, 0.0)
        if count == 2:
            offsets = [0.0, max_start]
        else:
            step = max_start / max(count - 1, 1)
            offsets = [step * index for index in range(count)]

    clips: list[dict[str, Any]] = []
    for index, offset in enumerate(offsets, start=1):
        clip_path = clips_dir / f"clip_{index:02d}.mp4"
        process = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-ss",
                f"{offset:.2f}",
                "-i",
                str(video_path),
                "-t",
                str(clip_duration),
                "-c:v",
                "libx264",
                "-c:a",
                "aac",
                str(clip_path),
            ],
            capture_output=True,
            text=True,
            timeout=600,
        )
        if process.returncode == 0 and clip_path.exists():
            clips.append(
                {
                    "index": index,
                    "offset": round(offset, 2),
                    "duration": clip_duration,
                    "path": str(clip_path),
                }
            )
    return clips


def load_raw_video_records(library_root: Path, series: str, instance: str, platform: str, account_folder: str) -> list[dict[str, Any]]:
    raw_root = series_paths(library_root, series, instance)["asset_base"] / "raw" / platform_dir_key(platform) / account_folder
    if not raw_root.exists():
        return []

    records: list[dict[str, Any]] = []
    for child in sorted(raw_root.iterdir()):
        if not child.is_dir() or child.name.startswith("._"):
            continue
        raw_info_path = child / "raw_video_info.json"
        transcript_path = child / "transcript.md"
        video_files = [path for path in child.glob("*.mp4") if not path.name.startswith("._")]
        video_path = video_files[0] if video_files else None
        payload = read_json(raw_info_path) if raw_info_path.exists() else {}
        video_info = payload.get("video_info") or {}
        records.append(
            {
                "content_id": child.name,
                "dir": str(child),
                "video_path": str(video_path) if video_path and video_path.exists() else None,
                "raw_info_path": str(raw_info_path) if raw_info_path.exists() else None,
                "transcript_path": str(transcript_path) if transcript_path.exists() else None,
                "title": str(video_info.get("title", "")).strip(),
                "source_url": str(payload.get("original_share_text") or payload.get("source_url") or "").strip(),
            }
        )
    return records
