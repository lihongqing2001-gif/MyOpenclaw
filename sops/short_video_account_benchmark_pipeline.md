# SOP: 短视频对标账号分析三阶段链路

## Goal
围绕一个真实对标账号，把多条视频先采成 raw 证据层，再并行做单视频 Gemini 深拆，最后汇总成真正可用的账号分析包。

## Stages

### Stage 1. Raw 收集

目的：
- 只负责把样本视频抓下来
- 保留视频、基础元数据、transcript、raw meta

命令：

```bash
python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_short_video_account_raw_collect.py --manifest-path <sample_manifest.json>
```

产物：
- `raw/.../<content_id>/`
- `raw_collection_summary.json`

### Stage 2. 单视频 Gemini 深拆

目的：
- 每个视频一个独立 Gemini session
- 在该视频自己的 session 中连续多轮追问
- 并行处理多个视频
- 默认支持断点续跑；如果某条视频已经生成深拆报告，后续继续执行时应跳过它

命令：

```bash
python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_short_video_account_deep_analysis.py --manifest-path <sample_manifest.json>
```

产物：
- 每个视频自己的：
  - `分析报告__gemini多轮增强__runtime.md`
  - `文案与讲解分析__runtime.md`
  - `节奏与转场分析__runtime.md`
  - `导演复刻建议__runtime.md`
- 批次级：
  - `deep_analysis_batch.json`

### Stage 3. 账号综合分析

目的：
- 不再吃浅层 heuristic `analysis.json`
- 直接吃每条视频的深拆报告
- 输出真正的账号分析包和改进建议

命令：

```bash
python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_short_video_account_synthesis.py --manifest-path <sample_manifest.json> --deep-batch-path <deep_analysis_batch.json>
```

产物：
- `账号分析包__runtime.md`
- `account_synthesis_raw.json`
- `质量评分卡__runtime.md`

## Rules

- raw 层不是账号分析包
- 单视频深拆层才是账号分析的核心证据层
- 账号综合分析只能消费深拆层产物，不直接消费浅层 heuristic 分析
- 同时可以开多个 Gemini session 处理多个视频
- 但同一个视频内部必须固定在它自己的 session 里多轮追问
