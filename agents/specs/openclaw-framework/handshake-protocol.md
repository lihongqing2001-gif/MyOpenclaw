# App Handshake Protocol (v0.2)

## Mode
App 拉取 OpenClaw（pull model）。

## Endpoints
- GET /api/v1/skill-tree
- GET /api/v1/stream (SSE)
- GET /api/v1/sop/:id
- POST /api/v1/node-execute
- POST /api/v1/foundation-setup

## Skill-tree Payload (minimum)
- nodes: id, title, nodeType, dependencies, status, capability_id (optional), sop_id (optional)
- edges: id, source, target

## SSE Events
- init
- node_updated
- skill_tree_updated
- task_updated

## Contract
- skill-tree 返回 nodes + edges
- 节点 status 由 OpenClaw 健康检查决定
- SOP 被阻断时必须回传依赖缺失原因
