# SOP Dependency Mapping (v0.2)

## Rule
SOP 依赖未满足时 UI 必须阻断执行；修复后自动解锁。

## Inputs
- capability-manifest.json dependencies
- foundation node health status

## Output
- SOP status: ready | blocked | error

## Auto-archive
- SOP 执行产出统一写入 outputs/<capability>/<sop>/<timestamp>/
- 需要在 task evidence 中记录 artifact paths
