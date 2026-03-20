# mappings AI 说明

这是长期库的规则与映射层。

## 读取顺序

1. 先读本文件
2. 再读 `LIBRARY_MANIFEST.json`
3. 然后按顺序读：
   - `project-series.json`
   - `migration-policy.json`
   - `workspace-to-library.json`

## 你的职责

- 不要凭感觉决定迁移目标
- 先通过项目系列注册表找到系列
- 再通过迁移策略确认该进 `assets` 还是 `knowledge`
- 最后通过 `workspace-to-library.json` 记录新映射

## 更新规则

- 更新映射前先确认：
  - 项目系列已存在
  - 实例名符合 `YYYY-MM__主题`
  - 目标层级正确
- 不要删除旧映射
- 不要把尚未验证的移动写成 `migrated`
- copy-first 阶段只允许：
  - `copied`
  - `legacy-copied`
  - `planned`

## 禁止事项

- 不要跳过 `project-series.json`
- 不要让领域直接变成主目录
- 不要把运行层目录标成已完成迁移
