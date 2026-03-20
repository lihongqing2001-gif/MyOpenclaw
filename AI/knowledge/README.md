# knowledge 入口说明

这里放长期保留的**知识层**内容。

## 应该放什么

- 案例
- 教训
- 规则
- 参考文档
- 索引说明
- 共享知识
- taxonomy

## 不该放什么

- 原始资产原件
- 附件
- 大体积交付物
- auth / runtime state

## 正式结构

- `projects/`
  - 项目知识主层
- `shared/`
  - 跨项目复用知识
- `_taxonomy/`
  - 领域、标签、分类体系

## 当前兼容导入目录

- `agents/`
- `content-system/`

这些是第一批复制的旧结构，用于过渡查阅，不是最终项目主轴。

## 正式项目结构

- `projects/<项目系列>/<实例>/cases`
- `projects/<项目系列>/<实例>/lessons`
- `projects/<项目系列>/<实例>/references`
- `projects/<项目系列>/<实例>/rules`
- `projects/<项目系列>/<实例>/indexes`

## 共享知识结构

- `shared/cases`
- `shared/lessons`
- `shared/references`
- `shared/rules`
- `shared/indexes`

## 命名规则

- 文件名默认短命名：
  - `<主题>__runtime.md`
  - `<主题>__confirmed.md`
  - `<主题>__draft.md`
  - `<主题>__final.md`
- 领域通过 taxonomy/tag 表达，不进主目录
