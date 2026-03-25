# SOP: 博客文章分析与改写方案

## Goal
对一篇博客文章做结构、观点、风格与可传播性分析，并输出改写建议或多平台转化方案。

## Default Trigger
- “分析这篇博客”
- “给这篇博客做改写方案”
- “看看它适不适合转成内容包”

## Inputs
- 博客链接或文章正文
- 分析目标
- 是否要改写

## Required Skills
- web-search-plus
- frontend-design
- assistant-orchestrator

## Preconditions
- 文章可访问
- 允许写入 `outputs/`

## Output Contract
- `outputs/博客分析_<主题>.md`

至少包含：
- 核心观点
- 结构拆解
- 风格特征
- 改写建议
- 多平台转化方向

## Steps
1) 获取文章内容
2) 提取结构和观点
3) 分析风格与受众
4) 输出改写与转化建议

## Failure Handling
- 如果网页抓取失败，允许用户粘贴正文继续分析
