# mappings 入口说明

这里放长期库与 workspace 之间的结构规则和映射关系。

## 应该放什么

- 路径迁移表
- 项目系列注册表
- 迁移策略文件
- taxonomy 与项目之间的关系说明

## 不该放什么

- 原始资产
- 知识正文
- 运行缓存

## 当前关键文件

- `workspace-to-library.json`
  - 旧路径到长期库路径的映射
- `project-series.json`
  - 项目系列定义、实例、领域标签
- `migration-policy.json`
  - 哪些迁、哪些不迁、哪些后面再筛

## 使用方式

- 先查项目系列
- 再查具体实例
- 再确认目标层是 `assets` 还是 `knowledge`
- 最后才执行复制、迁移或索引
