# assets AI 说明

这是长期资产原件层。

## 读取顺序

1. 先读本文件
2. 再读 `LIBRARY_MANIFEST.json`
3. 如涉及迁移，再读：
   - `../mappings/workspace-to-library.json`
   - `../mappings/project-series.json`
   - `../mappings/migration-policy.json`

## 你可以写什么

- 原始资料
- 交付物
- 归档快照
- 导出文件

## 你不能写什么

- 提炼型知识总结
- runtime lessons
- cases Markdown
- 规则文档
- 临时 agent 状态

## 写入规则

- 目标结构按项目系列组织
- 当前兼容导入目录允许存在，但不要继续扩张
- 新增结构优先走：
  - `<项目系列>/<实例>/raw`
  - `<项目系列>/<实例>/research`
  - `<项目系列>/<实例>/deliverables`
  - `<项目系列>/<实例>/archive`

## 禁止事项

- 不要把知识型 Markdown 写进这里
- 不要把领域当成主目录轴
- 不要为了机器解析继续生成超长全语义文件名
