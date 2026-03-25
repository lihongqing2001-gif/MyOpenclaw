# SOP: 小红书单条笔记分析与知识入库

## Goal
针对一条小红书笔记链接，抓取笔记详情和代表性评论，输出一份结构化分析报告，并把结果同时沉淀到长期知识库与长期资产库。

## Default Trigger
- “分析这条小红书笔记”
- “给这条小红书链接做分析”
- “把这条笔记拆解一下并入库”
- “总结这条笔记，放进知识库”

## Inputs
- 小红书笔记链接
- 分析目标（可选）
- 项目系列（可选，默认 `AI内容系统`）
- 项目实例（可选，默认 `YYYY-MM__单条内容分析`）

## Preconditions
- `xiaohongshu-skills` 可用
- Chrome 已登录小红书
- 长期库根目录已配置
- 允许写入长期知识库与资产库

## Output Contract
默认同时生成三类产物：

1. 长期知识库案例
- `knowledge/projects/<项目系列>/<项目实例>/cases/xiaohongshu/<feed_id>/单条内容分析__runtime.md`

2. 长期资产库分析报告
- `assets/<项目系列>/<项目实例>/deliverables/xiaohongshu/<feed_id>/分析报告__runtime.md`

3. 原始抓取快照
- `assets/<项目系列>/<项目实例>/raw/xiaohongshu/<feed_id>/raw_note.json`

分析报告至少包含：
- 笔记标题
- 作者
- 类型
- 互动概况
- 标签
- 核心主题
- 内容结构判断
- 评论反馈信号
- 可复用切入角度
- 入库路径

## Commands

```bash
python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_xhs_single_note_analysis.py --note-url <小红书笔记链接>
```

## Steps
1) 解析链接
2) 解析短链并提取 `feed_id` 与 `xsec_token`
3) 用 `xiaohongshu-skills` 抓取笔记详情
4) 生成结构化分析
5) 写入长期资产库和长期知识库
6) 返回结果路径和摘要
7) 如在 Mission Control 中执行，则由 resident agent 自动追加 runtime case 与 `qmd update`

## Failure Handling
- 如果短链无法解析：返回明确解析失败原因
- 如果登录态失效：提示先执行小红书登录检查
- 如果笔记被风控或不可访问：记录失败原因，不写入伪分析
- 如果长期库路径不存在：自动创建必要目录
