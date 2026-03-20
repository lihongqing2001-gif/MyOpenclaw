# assets 入口说明

这里放长期保留的**原件层**内容。

## 应该放什么

- 研究资料
- 原始素材
- 交付物
- 附件
- 归档快照
- 导出文件

## 不该放什么

- 提炼型知识 Markdown
- SOP 规则正文
- skill 规则正文
- agent runtime state
- memory 主存

## 目标结构

正式结构：

- `<项目系列>/<实例>/raw`
- `<项目系列>/<实例>/research`
- `<项目系列>/<实例>/deliverables`
- `<项目系列>/<实例>/archive`

当前仍保留兼容导入目录：

- `content-system/`
- `workspace-outputs/`

这些是过渡层，不是最终写入规范。

## 命名规则

- 目录负责项目系列和实例
- 文件名尽量短，只表达主题和状态/版本
- 交付物默认：
  - `<主题>__final.<ext>`
- 草稿默认：
  - `<主题>__draft.<ext>`
- 快照默认可带日期

## 查找方式

- 先找项目系列
- 再找实例
- 再按 `raw / research / deliverables / archive` 找

不要先靠超长文件名搜索。
