# SOP: Gemini 多轮视频追问分析

## Goal
针对一个本地视频文件，在同一个 Gemini 会话里先上传视频，再结合 transcript 连续追问多个细化问题，最终形成一份高价值单条视频深拆报告。

## Default Trigger
- “用 Gemini 在同一个对话里连续分析这个视频”
- “同一个视频让 Gemini 多轮追问”
- “先分析视频，再继续追问更多细节”

## Inputs
- 本地视频路径
- 输出目录（可选）
- 模型（可选，默认 `gemini-3-pro`）
- transcript 路径（可选）
- 追问轮次 JSON（可选）
- rounds profile（可选，默认 `deep-video-analysis-v1`）
- 最大轮次（可选）

## Preconditions
- `baoyu-danger-gemini-web` 已完成 consent 与登录
- `bun` 可用
- 视频文件可读
- 允许较长等待时间
- 如果要自动转写，环境中需要可用的 `OPENAI_API_KEY`

## Output Contract
- `<交付目录>/分析报告__gemini多轮增强__runtime.md`
- `<交付目录>/文案与讲解分析__runtime.md`
- `<交付目录>/节奏与转场分析__runtime.md`
- `<交付目录>/导演复刻建议__runtime.md`
- `<交付目录>/gemini_multiturn_video_analysis_raw.json`
- `<交付目录>/gemini_multiturn_summary.json`
- `<交付目录>/prompt_rounds.json`
- `<交付目录>/transcript.txt` 或 `<交付目录>/transcript.md`

## Commands

```bash
python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_gemini_video_multiturn_analysis.py --video-path <本地视频路径>
```

## Steps
1) 准备 transcript 证据：优先用显式 `--transcript-path`，否则读取已有 transcript；如允许且环境具备能力，则自动转写
2) 生成唯一 session ID
3) 第一轮把完整视频作为 reference 上传给 Gemini，并连同 transcript 上下文一起建立完整分析上下文
4) 在同一 session 中继续追问多个细节问题
5) 汇总多轮回答，拆成总报告 + 子报告

## Default Profile

默认 `rounds profile = deep-video-analysis-v1`，推荐 5 轮：

1. 总览与定位
2. 文案与讲解分析
3. 节奏与转场分析
4. 视觉与导演分析
5. 复刻与改写建议

默认模型：

- `gemini-3-pro`

默认策略：

- 深度优先，不追求快返

## Failure Handling
- 如果视频不存在：立即失败并返回路径错误
- 如果 transcript 缺失或失败：流程继续，但必须在报告中显式标注“文案层为降级判断”
- 如果首轮上传成功但后续追问失败：保留已成功轮次和 session ID，便于继续追问
- 如果整段视频处理延迟很高：建议回退到“关键帧增强分析”作为默认稳定方案
