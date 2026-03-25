# SOP: 本地视频 Gemini 增强分析

## Goal
针对一个已经落地到本地的视频文件，自动抽取关键帧，调用 Gemini Web 做细粒度内容拆解，并把增强分析报告写回该视频对应的交付目录。
这是稳定默认链，不是最高深度链。

## Default Trigger
- “用 Gemini 细拆这个本地视频”
- “帮我把这个视频做增强分析”
- “对这个落地视频做导演级拆解”

## Inputs
- 本地视频路径
- 标题（可选）
- 输出目录（可选）
- 额外分析要求（可选）

## Preconditions
- `baoyu-danger-gemini-web` 已完成 consent 与登录
- `bun` 可用
- `ffmpeg` / `ffprobe` 可用
- 视频文件可读

## Output Contract
- `<交付目录>/分析报告__gemini增强__runtime.md`
- `<交付目录>/gemini_video_analysis_raw.json`
- `<交付目录>/gemini_analysis_prompt.txt`
- `<交付目录>/gemini_frames/`

如果未显式指定输出目录，默认从视频路径推断到同内容 ID 的 `deliverables/` 目录。

## Positioning

适合：

- 日常分析
- 批量样本
- 希望更快返回的场景

不适合：

- 需要逐层拆文案、节奏、转场、讲解推进的高价值深拆

当你需要更深的单条视频分析时，改用：

- `Gemini 多轮视频追问分析`

## Commands

```bash
python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_gemini_video_enhanced_analysis.py --video-path <本地视频路径>
```

## Steps
1) 读取视频元数据与标题
2) 抽取多张关键帧
3) 构造细粒度分析提示词
4) 调用 Gemini Web 做关键帧增强分析
5) 写回 Markdown 报告、原始 JSON、关键帧清单与提示词

## Failure Handling
- 如果视频不存在：立即失败并返回明确路径错误
- 如果关键帧抽取失败：不调用 Gemini，直接返回抽帧失败
- 如果 Gemini 长时间无响应：保留关键帧和 prompt，方便后续重试
- 如果模型返回内容为空：保留 raw JSON 并提示人工复核
