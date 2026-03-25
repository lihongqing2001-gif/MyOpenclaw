# SOP: 收藏视频洞察入库

## Goal
针对一条你收藏或转发给系统的短视频链接，生成一份可阅读、可检索、可继续提问的洞察记录，并写入长期资产库与知识库。

## Default Trigger
- “把这条收藏视频记下来并分析”
- “这条视频给我很多启发，帮我入库”
- “记录这条视频，方便后面直接问你”

## Inputs
- 视频链接
- 收藏原因 / 备注（可选）
- 洞察目标（可选）
- 收藏集合名（可选，默认 `收藏视频`）

## Output Contract
- `assets/<项目系列>/<项目实例>/deliverables/inspiration/<platform>/<集合>/<content_id>/洞察记录__runtime.md`
- `assets/<项目系列>/<项目实例>/deliverables/inspiration/<platform>/<集合>/<content_id>/insight_bundle.json`
- `knowledge/projects/<项目系列>/<项目实例>/cases/inspiration/<platform>/<集合>/<content_id>/收藏视频洞察__runtime.md`

## Commands

```bash
python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_saved_video_insight_capture.py --video-url <视频链接>
```

## Steps
1) 识别平台并调用对应单条分析脚本
2) 生成标准分析产物
3) 补一层“为什么值得收藏 / 给我的启发 / 方向引导 / 可继续追问”
4) 写入长期资产库与知识库

## Failure Handling
- 如果平台不支持：返回明确错误
- 如果链接无法解析：保留失败原因，不写伪记录
- 如果转写不可用：保留基础分析与洞察记录，明确标注限制
