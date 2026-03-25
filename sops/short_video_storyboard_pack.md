# SOP: 短视频脚本与分镜交付包

## Goal
围绕一个主题或已有文案，输出一套短视频可执行交付包。

## Default Trigger
- “帮我做短视频脚本”
- “做一版分镜和口播”
- “把这篇内容改成视频方案”

## Inputs
- 主题或源内容
- 平台
- 时长
- 风格

## Required Skills
- remotion-best-practices
- ai-image-generation
- assistant-orchestrator

## Preconditions
- 源材料可访问或已提供
- 允许写入 `outputs/`

## Output Contract
- `outputs/短视频交付包_<主题>.md`

至少包含：
- 口播稿
- 分镜
- 镜头节奏
- 画面元素建议
- 封面标题

## Steps
1) 读取主题或源内容
2) 提炼短视频主钩子
3) 生成口播与分镜
4) 输出画面元素和封面建议

## Failure Handling
- 如果主题过泛，先收缩成单一观点
- 如果视频平台不同，按平台特性分别输出节奏建议
