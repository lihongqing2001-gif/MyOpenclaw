**OpenClaw 每次接管、部署、修复、扩展本项目时，必须先完整阅读本文件。若未遵守，本 UI 可视为未正确搭载。**

# OpenClaw Web 控制台自主搭载总规范

本文件是给 OpenClaw Agent 阅读的机器说明书。

目标只有一个：
让 OpenClaw 在尽量少依赖人工解释的情况下，自主识别、启动、连接、维护本 Web 控制台，并在需要权限时按列表逐项向用户申请，而不是一次性打包索权。

---

# 0. 长期库入口

凡是涉及长期资产、长期知识、迁移、归档规划、命名规范、项目系列结构时，必须先阅读：

- `/Volumes/For Win/01_Projects/AI/AI_INSTRUCTIONS.md`
- `/Volumes/For Win/01_Projects/AI/LIBRARY_MANIFEST.json`

如需处理资产层或知识层，再继续阅读：

- `/Volumes/For Win/01_Projects/AI/assets/LIBRARY_MANIFEST.json`
- `/Volumes/For Win/01_Projects/AI/knowledge/LIBRARY_MANIFEST.json`
- `/Volumes/For Win/01_Projects/AI/mappings/LIBRARY_MANIFEST.json`

禁止在未查长期库规则的前提下，自行决定长期资产或知识应落在哪个目录。

---

# 1. 总目标

你接手的是一个 OpenClaw Web 控制台项目。

它的职责不是执行业务，而是：
- 渲染 OpenClaw 的实时状态
- 展示真实技能树、SOP、知识与任务
- 让用户从 UI 触发节点执行
- 由独立常驻 OpenClaw Agent 领取任务并回写执行结果

你必须把它理解为：

`UI = 数字木偶`

也就是：
- 前端不拥有核心业务真相
- 业务状态由 broker + resident agent + OpenClaw workspace 共同提供
- UI 只负责渲染与交互

---

# 2. 项目角色划分

## 2.1 Web Broker

项目中的 broker 负责：
- 提供 React UI
- 提供 SSE 流
- 接收 UI 的执行请求
- 为 resident agent 排队任务
- 接收 resident agent 的状态回写
- 暴露真实技能树数据给前端

当前关键入口文件：
- `server.ts`

## 2.2 Resident OpenClaw Agent

resident agent 必须是单独常驻进程，不得把前端自己当执行器。

当前示例入口：
- `openclaw_agent.py`

它负责：
- 持续 heartbeat
- 主动 poll broker 获取任务
- 不直接把自己当最终执行专家
- 把任务转交给 `main` 作为主编排入口
- 由 `main` 根据规则继续分配给更合适的 agents
- 回传运行态、成功态、失败态
- 如有产物则回写知识库

额外强约束：
- resident agent 是 dispatcher / broker-side operator
- 默认执行目标必须是 `main`
- 不得默认把所有任务都交给 `engineer`
- `engineer` 只应处理真正的工程实现类任务

## 2.3 Frontend

前端只负责：
- 大厅 HUD
- 技能树视图
- Drawer 展示
- 用户点击后调用 broker 接口

前端关键入口：
- `src/App.tsx`
- `src/components/GlassDrawer.tsx`
- `src/components/SkillNodeComponent.tsx`

---

# 3. 真实数据源路径

OpenClaw 不得默认假设技能树来自前端 mock。

真实数据源优先级如下。

## 3.1 Content System Skill Tree

优先读取：
- `~/.openclaw/workspace/content_system/skilltree/data.json`

这是当前最接近结构化技能树主数据源的文件。

## 3.2 Installed Skills

读取：
- `~/.openclaw/workspace/skills/*/SKILL.md`
- `~/.agents/skills/**/SKILL.md`
- `~/.codex/skills/**/SKILL.md`

用途：
- 生成技能节点
- 提取名称、摘要、命令、能力、用例
- 自动合并进统一 skill index
- 自动加入知识库搜索与技能依赖解析

## 3.3 SOP Workflows

读取：
- `~/.openclaw/workspace/sops/*.md`

用途：
- 生成 SOP 工作流节点
- 提取触发条件、输入、步骤、命令、前置条件

## 3.4 Fallback Mock

仅当以上真实数据源全部不可用时，才允许使用前端 mock：
- `src/data/mockData.ts`

如果启用了 fallback mock，必须明确向用户报告：
- 哪些真实路径不可访问
- 当前仅为降级展示
- 不得伪装成真实树已成功接入

---

# 4. 技能树构建规则

OpenClaw 在构建技能树时，必须遵守以下映射规则。

## 4.1 三层结构

技能树必须映射成：
- Level 1 = Domain
- Level 2 = Area
- Level 3 = Executable Skill / SOP / Workflow

## 4.2 Content System 数据映射

对于 `content_system/skilltree/data.json` 中的每个条目：
- `category` -> Level 1
- `subcategory` -> Level 2
- 若无 `subcategory`
  - `nodeType = foundation` -> Level 2 使用 `基础能力`
  - 否则 -> Level 2 使用 `核心工作流`
- `title` -> Level 3 label
- `prerequisites` -> Drawer 的前置条件
- `invoke` -> commands / invoke
- `functions` -> capabilities
- `applications` -> useCases
- `portfolio` -> knowledgeBase.documents

## 4.3 Skill Markdown 映射

对于 `skills/*/SKILL.md`：
- frontmatter 的 `name` 优先作为 label
- frontmatter 的 `description` 或正文首段作为 summary
- `Key Features` / `Features` / `What Makes This Different?` 中的 bullet 作为 capabilities
- `Use Cases` 中的 bullet 作为 useCases
- 代码块或反引号命令中可执行项作为 commands

Skill 节点应统一挂到：
- Domain = `OpenClaw Skills`
- Area = `Installed Skills`

## 4.4 SOP Markdown 映射

对于 `sops/*.md`：
- 一级标题作为 label
- `Inputs` -> drawer inputs
- `Preconditions` -> prerequisites
- `Steps` -> capabilities
- `Default Trigger` -> useCases
- 文中的命令片段与 shell block -> commands

SOP 节点应统一挂到：
- Domain = `OpenClaw SOP`
- Area = `Standard Workflows`

## 4.5 唯一 ID 规则

每个节点必须拥有稳定 ID。

推荐：
- Domain: `domain-<slug>`
- Area: `area-<slug>`
- Content leaf: `content-<slug>`
- Skill leaf: `skill-<slug>`
- SOP leaf: `sop-<slug>`

不得使用每次随机变化的 ID。

## 4.6 状态规则

节点状态只允许：
- `idle`
- `running`
- `error`

UI 渲染时不得自创其他视觉状态名。

---

# 5. 前后端握手协议

OpenClaw 必须通过 broker 模式接入，不得让 UI 直接驱动内部执行器。

## 5.1 SSE

UI 监听：
- `GET /api/v1/stream`

broker 必须通过此流推送：
- `heartbeat`
- `node-update`
- `knowledge`
- `task-queued`
- `task-claimed`
- `task-updated`

## 5.2 Heartbeat

resident agent 必须持续调用：
- `POST /api/v1/heartbeat`

最小 payload：

```json
{
  "agentId": "openclaw-resident-agent"
}
```

建议频率：
- 约 5 秒一次

## 5.3 任务领取

resident agent 必须主动 poll：
- `POST /api/v1/agent/poll`

最小 payload：

```json
{
  "agentId": "openclaw-resident-agent"
}
```

如果返回：
- `task: null`

则继续轮询，不得报错退出。

## 5.4 UI 发起执行

Drawer 点击执行时，UI 必须调用：
- `POST /api/v1/node-execute`

最小 payload：

```json
{
  "nodeId": "xxx",
  "command": "..."
}
```

此接口的职责是：
- 入队
- 不直接同步执行

## 5.5 任务生命周期回写

resident agent 必须通过：
- `POST /api/v1/agent/task-update`

回写任务状态。

最小 payload：

```json
{
  "agentId": "openclaw-resident-agent",
  "taskId": "task_xxx",
  "status": "running|completed|failed",
  "nodeStatus": "running|idle|error",
  "resultSummary": "..."
}
```

规则：
- 开始执行时：`status=running` 且 `nodeStatus=running`
- 成功结束时：`status=completed` 且 `nodeStatus=idle`
- 执行失败时：`status=failed` 且 `nodeStatus=error`

## 5.6 知识回写

如果执行产出了知识、总结、策略、成品或可复用流程，必须与 `task-update` 一起或随后回写：

```json
{
  "knowledgeAction": "upsert|delete",
  "knowledgePayload": { ...KnowledgeItem }
}
```

---

# 6. OpenClaw 自主搭载流程

当 OpenClaw 第一次接管此项目时，必须按以下顺序执行。

## 6.1 启动前检查

必须确认：
- 项目根目录存在
- `package.json` 可用
- `server.ts` 存在
- resident agent 可执行
- OpenClaw workspace 真实数据源存在或能被访问

至少检查这些路径：
- `./server.ts`
- `./openclaw_agent.py`
- `~/.openclaw/workspace/content_system/skilltree/data.json`
- `~/.openclaw/workspace/skills`
- `~/.openclaw/workspace/sops`

## 6.2 安装依赖

若 `node_modules` 不存在，则安装：

```bash
npm install
```

## 6.3 启动 broker

启动方式优先：

```bash
npm run dev
```

若是生产场景，可采用生产启动，但必须保证以下端口可用：
- `localhost:3000`

## 6.4 启动 resident agent

启动：

```bash
python3 openclaw_agent.py
```

或等价常驻方式。

## 6.5 验证握手

必须至少验证以下事实：
- broker 在 `http://localhost:3000`
- `GET /api/v1/stream` 可连接
- `POST /api/v1/heartbeat` 后 agent 显示在线
- `POST /api/v1/agent/poll` 能返回任务或空任务
- UI 中 `WAITING FOR AGENT` 能变成 `AGENT LINKED`
- 任意 Level 3 节点可触发 `node-execute`
- 任务完成或失败后 UI 状态同步正确

---

# 7. 权限申请协议

这是强制规则。

OpenClaw 若需要额外权限，必须：
- 先识别具体权限
- 列成清单
- 一项一项向用户索取
- 每次只申请一项
- 用户未明确同意前不得执行该项

## 7.1 禁止行为

禁止：
- 一次性申请“所有权限”
- 模糊表达如“需要更多权限”
- 未说明用途直接要求放开沙箱
- 在未获批准时偷偷降级成错误实现却不告知用户

## 7.2 正确行为

每当需要权限时，必须报告：
- 权限编号
- 具体要访问什么
- 为什么需要
- 不给会影响什么
- 拟执行命令

然后等待用户同意。

## 7.3 权限清单模板

建议使用如下格式逐项索取：

```md
权限 1
- 类型：读取目录
- 目标：~/.openclaw/workspace/skills
- 用途：导入真实 Skills 到技能树
- 不授权影响：技能树只能显示 mock 或部分节点
- 计划命令：读取该目录及其中 SKILL.md
```

```md
权限 2
- 类型：读取文件
- 目标：~/.openclaw/workspace/content_system/skilltree/data.json
- 用途：导入真实 content skilltree 主数据
- 不授权影响：无法建立真实 Domain -> Area -> Workflow 树
- 计划命令：读取该 JSON 并转换为 SkillNode
```

```md
权限 3
- 类型：本地监听端口
- 目标：localhost:3000
- 用途：启动 broker
- 不授权影响：Web 控制台无法运行
- 计划命令：npm run dev
```

```md
权限 4
- 类型：执行 Python 进程
- 目标：openclaw_agent.py
- 用途：启动 resident agent
- 不授权影响：UI 只能展示，无法真正执行节点
- 计划命令：python3 openclaw_agent.py
```

## 7.4 权限申请顺序

推荐顺序如下：

1. 读取 OpenClaw workspace 中的真实技能树主数据
2. 读取 skills 目录
3. 读取 sops 目录
4. 启动 broker 所需端口权限
5. 启动 resident agent 所需执行权限
6. 如需写回知识或产物，再逐项申请目标写路径权限

---

# 8. 真实搭载时的输出要求

当 OpenClaw 完成或推进搭载时，必须向用户明确汇报：

## 8.1 已完成项

例如：
- broker 已启动
- agent 已在线
- skill tree 已从真实 workspace 读取
- 成功任务与失败任务已验证

## 8.2 降级项

如果用了 fallback，必须说明：
- 真实源为什么没接上
- 当前降级成了什么
- 还缺什么权限或数据

## 8.3 下一步建议

必须给出可执行下一步，例如：
- 重启 dev server
- 刷新浏览器
- 批准某个具体权限
- 指定某个真实技能目录

---

# 9. 当前项目中的已知实现事实

截至本说明更新时，项目已有以下事实：

- broker 通过 `server.ts` 提供接口
- resident agent 通过 `openclaw_agent.py` 示例运行
- skill tree 已支持从真实 OpenClaw workspace 导入
- skill tree 真实来源包括：
  - `~/.openclaw/workspace/content_system/skilltree/data.json`
  - `~/.openclaw/workspace/skills/*/SKILL.md`
  - `~/.openclaw/workspace/sops/*.md`
- 若真实源不可用，才会 fallback 到 `src/data/mockData.ts`

OpenClaw 不得忽略这些已实现能力并重新发明一套不兼容流程。

---

# 10. 最终执行原则

OpenClaw 在本项目中的最高优先原则如下：

1. 真实数据优先于 mock
2. broker 队列优先于前端直连执行
3. resident agent 必须独立常驻
4. 任何需要权限的动作都必须逐项申请
5. 若降级，必须明说
6. 若不确定数据源，先检查，不得臆测
7. UI 只负责渲染，不得把前端变成业务真相来源

---

# 10.1 飞书发布顺序约束

如果任务涉及飞书 / Lark 应用连接、接入、发布、审批验证，优先遵守下面这条人类已确认流程：

1. 在飞书开发者后台配置事件与回调
2. 订阅方式选择 `长连接接收事件`
3. 保存
4. 添加事件
5. `通讯录相关` 全部打勾
6. `消息与群组` 中至少勾选：
   - 接收消息
   - 机器人进群
7. 保存并确认
8. 返回开发者后台创建版本
9. 版本号可先填 `1.0.0`
10. 填写更新说明
11. 保存并确认发布
12. 打开飞书 App，等待应用审批通过通知
13. 打开应用，开始对话验证

额外要求：
- 不要默认选 HTTP 回调，优先长连接
- 不要跳过 `创建版本 -> 发布`
- 不要只在开发者后台判断成功，必须在飞书 App 内做最终验证

---

# 11. 最小成功判定

只有同时满足以下条件，才可视为 OpenClaw 已无障碍搭载本 app：

- 能启动 Web broker
- 能启动 resident agent
- UI 显示 agent 在线
- 技能树展示真实 workspace 节点，而不是只有 mock
- 用户点击 Level 3 节点可入队执行
- agent 能领取任务并回写运行态与结果态
- 至少一条成功路径验证通过
- 至少一条失败路径验证通过
- 如有产物，知识回写可被 UI 搜索到

若其中任一项不满足，必须继续修复或明确向用户报告缺失项与所需权限。

---

# 12. 可移植 SOP 能力包规范

OpenClaw 在新增、修复、验证任意 Level 3 SOP 后，必须优先考虑是否同步维护它的可移植安装包。

目标：
- 让新用户可以把单条 SOP 直接移植到新的 OpenClaw
- 让依赖、知识、脚本、安装步骤可追溯
- 让缺失能力在安装时被明确阻断，而不是运行时模糊报错

## 12.1 导出入口

优先使用：
- UI Drawer 中的 `Export Bundle`

也可以使用：
- `POST /api/v1/bundles/export`
- `python3 scripts/export_sop_bundle.py --node-id <nodeId>`
- `python3 scripts/export_sop_bundle.py --all`

## 12.2 标准产物结构

每个 bundle 至少必须包含：
- `capability-manifest.json`
- `dependency-hints.json`
- `README.md`
- `OPENCLAW.md`
- `install.py`
- `healthcheck.py`
- `sops/`

如果当前工作区存在本地资产，还应尽量一并打包：
- `skills/`
- `knowledge/`
- `scripts/`

## 12.3 Capability ID 规则

不得再用展示名称直接充当依赖 ID。

必须使用稳定 capability ID：
- SOP: `cap.openclaw.sop.<stable-token>`
- Foundation: `cap.openclaw.foundation.<stable-token>`
- Skill: `cap.openclaw.skill.<stable-token>`
- Integration: `cap.openclaw.integration.<stable-token>`

其中 `stable-token` 应尽量来自稳定 node id 或 module id，而不是临时 UI label。

## 12.4 依赖阻断规则

安装器必须先检查依赖，再复制内容。

如果发现外部依赖缺失：
- 必须阻断安装
- 必须列出缺失 capability ID
- 必须附带安装命令或文档链接
- 必须让用户按列表逐项补齐

不得：
- 静默跳过
- 假装安装成功
- 在缺依赖状态下让 bundle 进入 ready

## 12.5 索引规则

批量导出全部 Level 3 SOP 时，必须生成：
- `exports/bundles/index.json`

该索引至少应包含：
- nodeId
- nodeLabel
- capabilityId
- zipPath
- dependencies
- packagedCapabilities

## 12.6 OpenClaw 的后续义务

当某条 SOP 的真实依赖、脚本、知识发生变化时，OpenClaw 必须同步：
- 更新 skill tree 依赖元数据
- 重新导出对应 bundle
- 更新 README / USER_MANUAL 中的说明
- 如果新增权限需求，继续按列表逐项向用户申请
