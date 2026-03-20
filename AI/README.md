# AI 长期库总入口

这是 Agent OS 的长期库总根目录。

这里不是运行时 workspace，而是长期保留的资产层与知识层。  
运行、编排、agent 状态、SOP 与 skill 仍然主要在 OpenClaw workspace 中工作。

## 三层结构

- `assets/`
  - 放原件、研究资料、交付物、归档、附件、图片、导出文件
- `knowledge/`
  - 放结构化知识、案例、经验、教训、规则、索引、共享知识
- `mappings/`
  - 放迁移清单、项目系列注册表、策略文件、路径映射

## 当前边界

- 长期库主目录：
  - `/Volumes/For Win/01_Projects/AI`
- 运行层主目录：
  - `/Users/liumobei/.openclaw/workspace`

规则：

- 长期保留的原始资料优先进入 `assets/`
- 提炼后的知识表达优先进入 `knowledge/`
- 路径迁移、系列注册、规则收口进入 `mappings/`
- 运行缓存、auth、memory、agent 状态不直接写入这里

## 当前迁移状态

当前仍是**复制优先、非破坏迁移**阶段：

- workspace 原件仍然保留
- 长期资产与知识先复制到这里
- 新结构已建立，但默认写入路径尚未切换
- 一部分旧内容仍处于过渡兼容目录中

当前兼容导入目录：

- `assets/content-system/`
- `assets/workspace-outputs/`
- `knowledge/agents/`
- `knowledge/content-system/`

这些目录是第一批复制结果，不代表最终长期结构。

## 正式目标结构

长期目标不是按领域做主目录，而是按**项目系列**组织：

- `assets/<项目系列>/<实例>/...`
- `knowledge/projects/<项目系列>/<实例>/...`
- `knowledge/shared/...`
- `knowledge/_taxonomy/...`

其中：

- 项目系列名：中文稳定主名
- 项目实例名：`YYYY-MM__主题`
- 领域只通过 taxonomy 和 tags 表达，不再作为主目录轴

## 命名原则 V2

- 目录承载大语义：
  - 项目系列
  - 项目实例
  - 资产类别 / 知识类别
- 文件名承载小语义：
  - `<主题>__draft.md`
  - `<主题>__review.md`
  - `<主题>__final.md`
  - `<主题>__runtime.md`
  - `<主题>__confirmed.md`
- 只有天然时间型文档默认带日期：
  - 日报、周报、快照、运行记录、批次索引
- `human/ai` 只在确实存在双份文档时使用

## 建议阅读顺序

人类：

1. 先读本文件
2. 再读 `assets/README.md`
3. 再读 `knowledge/README.md`
4. 最后读 `mappings/README.md`

AI：

1. 先读 `AI_INSTRUCTIONS.md`
2. 再读 `LIBRARY_MANIFEST.json`
3. 再按 `read_order` 进入子库 manifest
