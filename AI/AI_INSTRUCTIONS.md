# AI 长期库总入口说明

你正在读取 Agent OS 的长期库总根目录说明。

## 先做什么

1. 先读本文件
2. 再读 `LIBRARY_MANIFEST.json`
3. 然后按顺序进入：
   - `assets/LIBRARY_MANIFEST.json`
   - `knowledge/LIBRARY_MANIFEST.json`
   - `mappings/LIBRARY_MANIFEST.json`

## 这个目录的职责

- 这里只承载长期资产、长期知识、迁移映射
- 这里不是运行时编排目录
- 这里不是 agent runtime state 目录

## 你可以写什么

- 资产层原件
- 知识层 Markdown
- taxonomy / mapping / migration 文件
- 入口说明与 manifest

## 你不能默认写什么

- `memory/`
- `MEMORY.md`
- auth / token / secret
- 运行缓存
- agent 心跳或状态文件
- 随机临时输出

## 存储规则

- 项目系列是主目录轴
- 领域不作为主目录轴，只能进入 taxonomy 和 tags
- 目录负责大语义，文件名负责小语义
- 不得继续生成超长全语义文件名

## 写入顺序

- 原件 -> `assets/`
- 提炼后的知识 -> `knowledge/`
- 路径迁移和结构规则 -> `mappings/`

## 当前阶段限制

- 当前仍是 copy-first 阶段
- 不要默认删除 workspace 原件
- 不要默认切换 `mission-control` 的写入路径
- 旧兼容导入目录仍然有效，但不是最终结构

## 当前兼容目录

- `assets/content-system`
- `assets/workspace-outputs`
- `knowledge/agents`
- `knowledge/content-system`

处理旧内容时：

- 先查 `mappings/workspace-to-library.json`
- 再查 `mappings/project-series.json`
- 不要自己猜目标项目系列
