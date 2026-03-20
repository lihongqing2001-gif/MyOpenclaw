# knowledge AI 说明

这是长期知识层。

## 读取顺序

1. 先读本文件
2. 再读 `LIBRARY_MANIFEST.json`
3. 再读 `_taxonomy/domains.json`
4. 如涉及迁移，再读：
   - `../mappings/workspace-to-library.json`
   - `../mappings/project-series.json`
   - `../mappings/migration-policy.json`

## 你可以写什么

- 案例
- lessons
- references
- rules
- indexes
- taxonomy 文件

## 你不能写什么

- 原始资产附件
- 大体积导出文件
- agent runtime 缓存
- secrets

## 写入规则

- 项目知识写入 `projects/<项目系列>/<实例>/...`
- 跨项目知识写入 `shared/...`
- 领域只能进入 `_taxonomy` 和 tags
- 不要继续扩张旧兼容目录 `agents/` 与 `content-system/`

## 判断规则

- 任务直接产出的经验总结、运行案例、失败教训 -> `projects/...` 或 `shared/...`
- 可跨项目复用的方法、通用规则、抽象参考 -> `shared/...`
- 仅属于某个项目上下文的说明 -> `projects/...`
