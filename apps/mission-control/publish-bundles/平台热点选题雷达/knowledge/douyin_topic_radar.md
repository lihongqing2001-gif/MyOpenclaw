# SOP: 抖音热点雷达与选题池

## Goal
围绕一个主题或账号方向，持续发现抖音近期值得跟进的热点话题，并输出可直接进入内容排期的选题池。

## Default Trigger
- “做一版抖音热点雷达”
- “最近抖音这个方向有什么能做的”
- “帮我找 10 个抖音选题”

## Inputs
- 主题 / 赛道
- 时间范围
- 输出数量
- 对标账号（可选）

## Required Skills
- web-search-plus
- 抖音数据抓取/趋势分析 skill
- assistant-orchestrator

## Preconditions
- 至少能使用搜索或平台内数据来源
- 允许写入 `content_system/01_research/`

## Output Contract
- `content_system/01_research/选题雷达/<日期>_<主题>_抖音选题池.md`

至少包含：
- 热点主题
- 触发原因
- 推荐切入角度
- 风险提示
- 优先级

## Steps
1) 明确主题与时间窗口
2) 搜索抖音热点与相关信号
3) 聚类去重
4) 输出高优先级选题池

## Failure Handling
- 如果平台内数据能力不可用，先回退到公开搜索与站外信号
- 如果主题太泛，先自动拆成子主题
