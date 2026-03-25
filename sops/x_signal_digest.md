# SOP: X 趋势信号摘要与观点池

## Goal
围绕一个关键词、人物、品牌或行业，持续整理 X 上的热门观点、争议点和可转化内容角度。

## Default Trigger
- “帮我看 X 上最近怎么讨论这个主题”
- “做一版 X 趋势摘要”
- “整理成观点池”

## Inputs
- 关键词 / 主题
- 时间范围
- 输出数量
- 是否需要中文转写

## Required Skills
- web-search-plus
- X / Twitter 搜索或抓取 skill
- assistant-orchestrator

## Preconditions
- 至少可以访问公开搜索来源
- 允许写入 `content_system/01_research/`

## Output Contract
- `content_system/01_research/X信号/<日期>_<主题>_观点池.md`

至少包含：
- 代表性观点
- 主要争议
- 可转化选题
- 潜在风险

## Steps
1) 搜索指定主题在 X 上的近期信号
2) 提取高频观点和争议点
3) 生成内容角度与摘要
4) 输出观点池

## Failure Handling
- 如果平台能力缺失，回退到搜索摘要模式
- 如果噪音过高，优先过滤转载与重复信号
