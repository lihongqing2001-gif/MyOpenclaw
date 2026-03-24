import argparse
import json
import shutil
import subprocess
import urllib.request
from pathlib import Path

from _short_video_factory import read_json, write_json, write_text


FONT_PATHS = [
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
]


def pick_font() -> str | None:
    for candidate in FONT_PATHS:
        if Path(candidate).exists():
            return candidate
    return None


def build_director_note(brief: dict) -> str:
    return f"""# 导演说明书

## 核心策略

- 模仿策略：{brief['imitation_strategy']}
- 目标平台：{brief['target_platform']}
- 目标时长：{brief['duration_target']} 秒
- 语气：{brief['tone']}

## 导演判断

- 真人口播承担观点推进和人格感。
- AI 补镜只承担气氛、转场和抽象概念解释。
- 节奏采用“钩子 -> 观点展开 -> 情绪落点 -> CTA”四段结构。
- 不逐句复刻原视频，而是复用其节奏与表达密度。

## 创作边界

""" + "\n".join(f"- {item}" for item in brief["must_change_patterns"]) + """
"""


def build_voice_script(brief: dict) -> str:
    hook = brief["human_shoot_segments"][0]["script_focus"]
    core = brief["human_shoot_segments"][1]["script_focus"]
    return f"""# 口播脚本

## 开头

{hook}。先用一句问题或反差，把用户停住。

## 主体

{core}。用你自己的案例或观察把观点讲透，不直接照搬原账号文案。

## 收尾

给一个能引发评论或收藏的收尾句，再落一个明确 CTA。
"""


def build_storyboard(brief: dict) -> list[dict]:
    return [
        {
            "scene_id": "scene-01",
            "title": "Hook",
            "type": "human",
            "duration_sec": 6,
            "visual": "中近景真人口播，开场问题句",
            "script": brief["human_shoot_segments"][0]["script_focus"],
        },
        {
            "scene_id": "scene-02",
            "title": "Reference Pattern",
            "type": "reference",
            "duration_sec": 5,
            "visual": "参考样本中的节奏或镜头质感，不直接复刻内容",
            "script": "插入参考素材或相似情绪段",
        },
        {
            "scene_id": "scene-03",
            "title": "Core Explanation",
            "type": "human",
            "duration_sec": 16,
            "visual": "真人正面口播 + 关键词字幕",
            "script": brief["human_shoot_segments"][1]["script_focus"],
        },
        {
            "scene_id": "scene-04",
            "title": "AI B-roll",
            "type": "ai",
            "duration_sec": 4,
            "visual": "抽象情绪或概念补镜",
            "script": "用 AI 片段做情绪补强和转场",
        },
        {
            "scene_id": "scene-05",
            "title": "CTA",
            "type": "human",
            "duration_sec": 4,
            "visual": "真人收尾或封面式结尾镜头",
            "script": "评论区互动 + 收藏引导",
        },
    ]


def build_ai_prompt_pack(brief: dict, scene_plan: list[dict]) -> dict:
    ai_scenes = [scene for scene in scene_plan if scene["type"] == "ai"]
    prompts = []
    for scene in ai_scenes:
        prompts.append(
            {
                "scene_id": scene["scene_id"],
                "mode": "text-to-video",
                "duration_sec": scene["duration_sec"],
                "aspect_ratio": "9:16",
                "prompt": f"{scene['visual']}，vertical short-video b-roll, soft cinematic motion, emotionally supportive transition shot",
            }
        )
    return {
        "engine": "videoagent-video-studio",
        "status": "pending",
        "reason": "VideoAgent proxy must be reachable before clip generation can complete.",
        "prompts": prompts,
    }


def build_asset_manifest(brief: dict, scene_plan: list[dict], ai_prompt_pack: dict) -> dict:
    first_source = (brief.get("source_contents") or [{}])[0]
    artifact_refs = first_source.get("artifact_refs", [])
    reference_video = next((item for item in artifact_refs if item and item.endswith(".mp4")), "")
    return {
        "target_platform": brief["target_platform"],
        "reference_video": reference_video,
        "scene_plan": scene_plan,
        "ai_prompt_pack": ai_prompt_pack,
        "human_segments": brief["human_shoot_segments"],
        "required_inputs": [
            "真人口播原始视频",
            "可选 AI 补镜片段",
            "封面图与标题",
        ],
    }


def create_title_clip(output_path: Path, title: str, duration: int) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"color=c=0x111827:s=720x1280:d={duration}",
            "-pix_fmt",
            "yuv420p",
            str(output_path),
        ],
        capture_output=True,
        text=True,
        timeout=120,
        check=True,
    )


def create_reference_clip(source_video: str, output_path: Path, duration: int) -> bool:
    if not source_video or not Path(source_video).exists():
        return False
    process = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            source_video,
            "-t",
            str(duration),
            "-vf",
            "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2",
            "-an",
            str(output_path),
        ],
        capture_output=True,
        text=True,
        timeout=180,
    )
    return process.returncode == 0 and output_path.exists()


def concat_clips(clip_paths: list[Path], output_path: Path) -> None:
    list_path = output_path.parent / "concat_list.txt"
    list_path.write_text(
        "\n".join(f"file '{clip.as_posix()}'" for clip in clip_paths),
        encoding="utf-8",
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_path),
            "-c",
            "copy",
            str(output_path),
        ],
        capture_output=True,
        text=True,
        timeout=180,
        check=True,
    )


def build_publish_pack(brief: dict) -> str:
    return f"""# 发布包

## 标题候选

- 用一个问题句开头，承接 {brief['imitation_strategy']}
- 保留对标内容的张力，但换成你自己的话题切口

## 文案框架

- 第一行：抛钩子
- 中段：补一段你自己的案例或判断
- 结尾：引导评论 / 收藏 / 关注

## 标签建议

- #短视频
- #内容拆解
- #口播视频

## 发布时间建议

- 晚间 19:00-22:00 作为首批试发窗口

## 手动发布 SOP

- 检查口播画面、字幕、封面和标题是否统一
- 先导出粗剪，再进剪辑软件补真人素材和精修节奏
- 发布前确认平台规格、封面裁切和首屏标题
"""


def build_edit_notes(brief: dict, ai_prompt_pack: dict, rough_cut_path: Path) -> str:
    lines = [
        f"粗剪已生成：{rough_cut_path}",
        "当前粗剪使用参考片段 + 占位卡片，供你确认结构和时长。",
        "真人口播素材到位后，用同名镜头段替换 placeholder clip。",
    ]
    if ai_prompt_pack.get("prompts"):
        lines.append("VideoAgent prompt pack 已生成；当前默认未自动拉取成片，请在代理可用后执行。")
    return "\n".join(f"- {line}" for line in lines)


def create_remotion_project(remotion_dir: Path, scene_plan_path: Path, asset_manifest_path: Path) -> None:
    remotion_src = remotion_dir / "src"
    remotion_src.mkdir(parents=True, exist_ok=True)
    shutil.copy2(scene_plan_path, remotion_src / "scene_plan.json")
    shutil.copy2(asset_manifest_path, remotion_src / "asset_manifest.json")
    write_text(
        remotion_dir / "package.json",
        """{
  "name": "short-video-rough-cut",
  "private": true,
  "type": "module",
  "scripts": {
    "preview": "remotion preview src/index.tsx",
    "render": "remotion render src/index.tsx ShortVideoRoughCut out/rough_cut.mp4"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "remotion": "^4.0.271"
  }
}
""",
    )
    write_text(
        remotion_dir / "tsconfig.json",
        """{
  "compilerOptions": {
    "jsx": "react-jsx",
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "esModuleInterop": true
  }
}
""",
    )
    write_text(
        remotion_src / "index.tsx",
        """import { registerRoot } from 'remotion';
import { Root } from './Root';

registerRoot(Root);
""",
    )
    write_text(
        remotion_src / "Root.tsx",
        """import React from 'react';
import { Composition } from 'remotion';
import { ShortVideoRoughCut } from './Video';
import scenePlan from './scene_plan.json';

export const Root: React.FC = () => {
  const duration = scenePlan.reduce((sum, scene) => sum + scene.duration_sec, 0);
  return (
    <Composition
      id="ShortVideoRoughCut"
      component={ShortVideoRoughCut}
      durationInFrames={duration * 30}
      fps={30}
      width={720}
      height={1280}
      defaultProps={{ scenePlan }}
    />
  );
};
""",
    )
    write_text(
        remotion_src / "Video.tsx",
        """import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';

export const ShortVideoRoughCut: React.FC<{ scenePlan: Array<{ title: string; duration_sec: number; visual: string; }> }> = ({ scenePlan }) => {
  let start = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: '#111827', color: 'white', fontFamily: 'Arial, sans-serif', justifyContent: 'center', alignItems: 'center' }}>
      {scenePlan.map((scene) => {
        const from = start;
        start += scene.duration_sec * 30;
        return (
          <Sequence key={scene.title} from={from} durationInFrames={scene.duration_sec * 30}>
            <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 80 }}>
              <div style={{ fontSize: 44, fontWeight: 700, marginBottom: 24 }}>{scene.title}</div>
              <div style={{ fontSize: 24, lineHeight: 1.5, textAlign: 'center', maxWidth: 540 }}>{scene.visual}</div>
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
""",
    )


def try_generate_ai_clip(prompt: dict, output_path: Path) -> dict:
    process = subprocess.run(
        [
            "node",
            "/Users/liumobei/.agents/skills/videoagent-video-studio/tools/generate.js",
            "--mode",
            prompt["mode"],
            "--prompt",
            prompt["prompt"],
            "--duration",
            str(prompt["duration_sec"]),
            "--aspect-ratio",
            prompt["aspect_ratio"],
        ],
        capture_output=True,
        text=True,
        timeout=240,
    )
    if process.returncode != 0:
        return {
            "scene_id": prompt["scene_id"],
            "success": False,
            "error": process.stderr.strip() or process.stdout.strip() or "VideoAgent generation failed",
        }
    payload = json.loads(process.stdout)
    video_url = payload.get("videoUrl", "")
    if not video_url:
        return {
            "scene_id": prompt["scene_id"],
            "success": False,
            "error": payload.get("message", "Video URL missing from VideoAgent response"),
        }
    urllib.request.urlretrieve(video_url, output_path)
    return {
        "scene_id": prompt["scene_id"],
        "success": output_path.exists(),
        "path": str(output_path),
        "video_url": video_url,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--creative-brief-path", required=True)
    parser.add_argument("--generate-ai-clips", default="no")
    args = parser.parse_args()

    creative_brief_path = Path(args.creative_brief_path).expanduser().resolve()
    if not creative_brief_path.exists():
        raise SystemExit(f"Creative brief not found: {creative_brief_path}")

    brief = read_json(creative_brief_path)
    production_dir = creative_brief_path.parent
    remotion_dir = production_dir / "remotion_project"
    ai_dir = production_dir / "ai_clips"
    ai_dir.mkdir(parents=True, exist_ok=True)

    scene_plan = build_storyboard(brief)
    ai_prompt_pack = build_ai_prompt_pack(brief, scene_plan)
    asset_manifest = build_asset_manifest(brief, scene_plan, ai_prompt_pack)

    director_note_path = production_dir / "导演说明书__draft.md"
    voice_script_path = production_dir / "口播脚本__draft.md"
    storyboard_path = production_dir / "分镜表__draft.md"
    shot_list_path = production_dir / "镜头清单__draft.md"
    subtitle_path = production_dir / "字幕稿__draft.md"
    ai_prompt_path = production_dir / "ai_clips_prompt_pack.json"
    asset_manifest_path = production_dir / "asset_manifest.json"
    scene_plan_path = production_dir / "scene_plan.json"
    publish_pack_path = production_dir / "publish_pack__draft.md"
    edit_notes_path = production_dir / "edit_notes.md"
    checklist_path = production_dir / "publish_checklist.md"
    rough_cut_path = production_dir / "rough_cut.mp4"
    blocker_path = production_dir / "production_blocker.json"

    write_text(director_note_path, build_director_note(brief))
    write_text(voice_script_path, build_voice_script(brief))
    write_text(
        storyboard_path,
        "# 分镜表\n\n" + "\n".join(
            f"- {scene['scene_id']} · {scene['title']} · {scene['duration_sec']}s · {scene['visual']}" for scene in scene_plan
        ),
    )
    write_text(
        shot_list_path,
        "# 镜头清单\n\n" + "\n".join(
            f"- {scene['scene_id']} · 类型：{scene['type']} · 脚本：{scene['script']}" for scene in scene_plan
        ),
    )
    write_text(
        subtitle_path,
        "# 字幕稿\n\n" + "\n".join(
            f"- {scene['title']}：{scene['script']}" for scene in scene_plan
        ),
    )
    write_json(ai_prompt_path, ai_prompt_pack)
    write_json(asset_manifest_path, asset_manifest)
    write_json(scene_plan_path, scene_plan)
    write_text(publish_pack_path, build_publish_pack(brief))
    write_text(checklist_path, "- 检查封面、标题、字幕、时长、首屏停留。\n- 替换真人口播占位段。\n- 平台发布前再次确认比例和裁切。")

    ai_results = []
    if args.generate_ai_clips.lower() in {"yes", "true", "1"}:
        for prompt in ai_prompt_pack.get("prompts", []):
            ai_output = ai_dir / f"{prompt['scene_id']}.mp4"
            ai_results.append(try_generate_ai_clip(prompt, ai_output))
        if any(not item.get("success") for item in ai_results):
            write_json(
                blocker_path,
                {
                    "kind": "videoagent_generation_failed",
                    "summary": "VideoAgent proxy is unavailable or clip generation failed.",
                    "details": ai_results,
                },
            )

    temp_dir = production_dir / "_rough_cut_parts"
    temp_dir.mkdir(parents=True, exist_ok=True)
    clip_paths = []
    intro_clip = temp_dir / "scene_01.mp4"
    create_title_clip(intro_clip, "Hook", 2)
    clip_paths.append(intro_clip)

    reference_clip = temp_dir / "scene_02.mp4"
    reference_video = asset_manifest.get("reference_video", "")
    if not create_reference_clip(reference_video, reference_clip, 5):
        create_title_clip(reference_clip, "Reference Pattern", 5)
    clip_paths.append(reference_clip)

    human_clip = temp_dir / "scene_03.mp4"
    create_title_clip(human_clip, "Human Shoot Here", 5)
    clip_paths.append(human_clip)

    ai_clip = temp_dir / "scene_04.mp4"
    first_ai = next((item.get("path") for item in ai_results if item.get("success")), "")
    if not create_reference_clip(first_ai, ai_clip, 4):
        create_title_clip(ai_clip, "AI B-roll Slot", 4)
    clip_paths.append(ai_clip)

    cta_clip = temp_dir / "scene_05.mp4"
    create_title_clip(cta_clip, "CTA", 3)
    clip_paths.append(cta_clip)
    concat_clips(clip_paths, rough_cut_path)

    write_text(edit_notes_path, build_edit_notes(brief, ai_prompt_pack, rough_cut_path))
    create_remotion_project(remotion_dir, scene_plan_path, asset_manifest_path)

    print(
        json.dumps(
            {
                "success": True,
                "creative_brief": str(creative_brief_path),
                "director_note": str(director_note_path),
                "voice_script": str(voice_script_path),
                "scene_plan": str(scene_plan_path),
                "asset_manifest": str(asset_manifest_path),
                "publish_pack": str(publish_pack_path),
                "rough_cut": str(rough_cut_path),
                "remotion_project": str(remotion_dir),
                "blocker": str(blocker_path) if blocker_path.exists() else "",
                "execution_summary": "已生成导演与生产链交付物，包括创作包、粗剪片和 Remotion 工程。",
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
