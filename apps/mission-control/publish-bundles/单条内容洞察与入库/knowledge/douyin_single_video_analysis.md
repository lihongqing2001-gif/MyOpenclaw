# SOP: 抖音单条视频分析与知识入库

## Goal
针对一条抖音分享链接，解析视频信息、下载视频、提取语音文案，输出一份结构化分析报告，并把结果同时沉淀到长期知识库与长期资产库。

## Default Trigger
- “分析这条抖音视频”
- “给这条抖音链接做分析”
- “把这条抖音内容拆解一下并入库”
- “总结这条抖音视频，放进知识库”

## Inputs
- 抖音分享链接
- 分析目标（可选）
- 项目系列（可选，默认 `AI内容系统`）
- 项目实例（可选，默认 `YYYY-MM__单条内容分析`）
- `API_KEY` 或 `--api-key`（用于语音转写）

## Preconditions
- `douyin-video` skill 可用
- `ffmpeg` 已安装
- 长期库根目录已配置
- 允许写入长期知识库与资产库

## Output Contract
默认同时生成四类产物：

1. 长期知识库案例
- `knowledge/projects/<项目系列>/<项目实例>/cases/douyin/<video_id>/单条内容分析__runtime.md`

2. 长期资产库分析报告
- `assets/<项目系列>/<项目实例>/deliverables/douyin/<video_id>/分析报告__runtime.md`

3. 原始信息快照
- `assets/<项目系列>/<项目实例>/raw/douyin/<video_id>/raw_video_info.json`

4. 转写与原始视频
- `assets/<项目系列>/<项目实例>/raw/douyin/<video_id>/transcript.md`
- `assets/<项目系列>/<项目实例>/raw/douyin/<video_id>/<video_id>.mp4`

可选增强产物：

5. Gemini 增强分析
- `assets/<项目系列>/<项目实例>/deliverables/douyin/<video_id>/分析报告__gemini增强__runtime.md`
- `assets/<项目系列>/<项目实例>/deliverables/douyin/<video_id>/gemini_video_analysis_raw.json`
- `assets/<项目系列>/<项目实例>/deliverables/douyin/<video_id>/gemini_frames/`

分析报告至少包含：
- 视频标题
- 视频 ID
- 原始链接与无水印地址
- 内容形态判断
- 开头钩子判断
- 受众判断
- 文案摘录
- 可复用切入角度
- 入库路径

## Commands

```bash
API_KEY=<硅基流动密钥> python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_douyin_single_video_analysis.py --video-url <抖音分享链接>
```

## Steps
1) 解析抖音分享链接
2) 获取视频 ID、标题和无水印下载地址
3) 下载原始视频
4) 抽取音频并调用转写 API
5) 生成结构化分析
6) 写入长期资产库和长期知识库
7) 返回结果路径和摘要
8) 如需更细的视频结构拆解，再基于本地视频路径执行 Gemini 增强分析 SOP
9) 如果需要更深的导演级拆解、文案/节奏/转场细分，再执行 Gemini 多轮视频追问分析 SOP

## Gemini 增强分析用法

当基础分析已经完成，且你想进一步拆镜头、节奏、可模仿打法时，直接对落地视频执行：

```bash
python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_gemini_video_enhanced_analysis.py --video-path <raw 目录中的 mp4 路径>
```

默认会把增强报告写到同一内容 ID 的 `deliverables/douyin/<video_id>/` 目录。

## Gemini 多轮深拆用法

当你要做高价值单条视频深拆，而不仅是关键帧增强时，执行：

```bash
python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_gemini_video_multiturn_analysis.py --video-path <raw 目录中的 mp4 路径>
```

默认特点：

- 模型：`gemini-3-pro`
- 优先使用 transcript 证据
- 同一视频在同一会话中连续多轮追问
- 输出总报告 + 子报告

## Failure Handling
- 如果链接无法解析：返回明确解析失败原因
- 如果 `API_KEY` 缺失：阻塞并提示补充转写密钥
- 如果视频下载失败：记录失败原因，不写入伪分析
- 如果转写失败：保留原始视频和基础信息，标记文案提取失败
- 如果长期库路径不存在：自动创建必要目录
