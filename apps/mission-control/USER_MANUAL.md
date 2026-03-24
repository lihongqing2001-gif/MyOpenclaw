# OpenClaw Web Console 用户手册

## 1. 这是什么

OpenClaw Web Console 是一个给 OpenClaw 使用者看的控制台。

它由三部分组成：

- Web 页面
- Broker 服务
- Resident Agent

作用：

- 浏览功能大类 / 领域 / SOP
- 查看每个 SOP 的输入、知识、最低技能模块
- 直接从 UI 触发任务
- 观察任务运行、失败和学习沉淀

## 2. 现在已经能做什么

当前版本已经具备这些能力：

- 首页可打开
- 技能树可打开
- 本地知识文档可打开
- 全局知识搜索可点击
- 中文自然语言参数可以进入命令占位符
- Level 3 SOP 可直接导出成可移植安装包
- 运行成功后会写出案例知识
- 运行后会触发 `qmd update`
- 文件类 SOP 已有显式执行器：
  - `自动整理归档`
  - `资料清单化与索引`
- 已支持本地视频的 Gemini 增强分析：
  - 先抽关键帧
  - 再调用 Gemini Web 做导演级拆解
  - 报告回写到视频对应的 `deliverables/` 目录

## 3. 地址

推荐直接使用：

- `http://127.0.0.1:3000`

不要优先用 `localhost`，因为本机代理或系统网络配置有时会让 `localhost` 行为不稳定。

## 4. 用户需要做什么

### 基础使用

1. 打开首页
2. 点击 `展开神经技能树`
3. 找到目标 SOP
4. 打开右侧侧边栏
5. 填写输入
6. 点击执行
7. 返回大厅查看运行结果

### 如果是有参数的 SOP

比如：

- `日程规划与冲突检测`
- `Xiaohongshu Comment Semantic Extraction (Auto Excel)`

你需要先填输入框，再点执行。

### 如果是依赖外部系统的 SOP

例如：

- 日历
- 小红书登录态
- 特定技能 CLI

你要保证这些前提已经准备好，否则系统会给出失败或部分成功结果。

### 如果你要把 SOP 带到新的 OpenClaw

1. 打开目标 SOP 的右侧抽屉
2. 点击 `Export Bundle`
3. 下载导出的 zip
4. 在新机器解压后运行 `python3 install.py`
5. 再运行 `python3 healthcheck.py`

如果安装器提示缺依赖：

- 按提示一个个安装
- 不要跳过
- 安装完再重新执行安装器

## 5. 如何判断任务到底有没有真跑

看三个地方：

### 1. Recent

大厅中的 `Recent` 会显示：

- 成功
- 失败
- 摘要

### 2. Toast

任务完成或失败时会弹提示。

### 3. 知识回写

成功后通常会出现：

- 运行案例
- 执行产物
- 运行教训

这些会进入知识搜索里。

## 6. 知识系统现在怎么工作

当前知识来源包括：

- `skills/*/SKILL.md`
- `skills/*/README.md`
- `~/.agents/skills/**/SKILL.md`
- `~/.codex/skills/**/SKILL.md`
- `sops/*.md`
- `content_system/skilltree/data.json`
- `agents/knowledge/**/*.md`
- Resident Agent 运行后写出的案例和教训
- `qmd` 搜索结果

### 运行后会学到什么

成功：

- 写入 `agents/knowledge/cases/`

失败：

- 写入 `agents/knowledge/runtime-lessons/`

然后自动运行：

- `qmd update`

## 7. 如何用 OpenClaw

### 方式一：直接通过 Web Console

这是最适合人的方式。

你只需要：

1. 打开技能树
2. 点开 SOP
3. 填写输入
4. 执行

### 方式二：让 OpenClaw 自己接手

OpenClaw 需要先读：

- `OPENCLAW_INSTRUCTIONS.md`
- `KNOWLEDGE_SYSTEM_DESIGN.md`

这样它才知道：

- 怎么握手
- 怎么学习
- 怎么写知识
- 怎么索引
- 怎么导出和安装可移植 SOP bundle

## 8. 如何把 SOP 移植到另一台机器

导出的 bundle 里现在至少会带上这些内容：

- `capability-manifest.json`
- `dependency-hints.json`
- `README.md`
- `OPENCLAW.md`
- `install.py`
- `healthcheck.py`
- `sops/`

如果该 SOP 在当前工作区有本地技能或脚本，还会一并打包：

- `skills/`
- `knowledge/`
- `scripts/`

导出位置默认在：

- `exports/bundles/`

如果你是命令行用户，也可以直接运行：

```bash
python3 scripts/export_sop_bundle.py --node-id <SOP 节点 ID>
```

如果你要一次性导出全部三级 SOP：

```bash
python3 scripts/export_sop_bundle.py --all
```

它会额外生成：

- `exports/bundles/index.json`

## 9. 哪些地方还不完美

当前还存在这些限制：

- 不是所有 SOP 都有完整执行器
- 一些 slash 风格命令仍依赖上游 OpenClaw agent 能力
- 有些 SOP 只能给出建议结果，还没有做到最终实物产出
- 运行证据虽然开始积累，但还需要更多真实运行来提高准确性

## 10. 当前最值得优先使用的 SOP

现在优先推荐先用这些：

- `日程规划与冲突检测`
- `自动整理归档`
- `资料清单化与索引`
- `小盖风格内容生成（厚版）`

这些已经是目前最接近真实可执行链的节点。

- `抖音单条视频分析与知识入库`
- `本地视频 Gemini 增强分析`

## 12. 如何做视频增强分析

适用场景：

- 你已经把视频抓取到本地
- 想进一步拆镜头、节奏、结构和可复刻打法

推荐顺序：

1. 先运行 `抖音单条视频分析与知识入库`
2. 确认 raw 目录中已经有 `.mp4`
3. 再运行 `本地视频 Gemini 增强分析`

命令：

```bash
python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_gemini_video_enhanced_analysis.py --video-path <本地 mp4 路径>
```

默认输出：

- `分析报告__gemini增强__runtime.md`
- `gemini_video_analysis_raw.json`
- `gemini_analysis_prompt.txt`
- `gemini_frames/`

注意：

- 默认稳定路径是“关键帧增强分析”，不是直接整段视频直传
- 原因是大视频直传到 Gemini Web 会有较高延迟，当前不适合作为默认生产路径
- 如果后续转写补齐，这份增强报告会更可靠

## 13. 如何做 Gemini Pro 多轮深度视频分析

适用场景：

- 你只分析少量高价值视频
- 你希望把文案、讲解顺序、节奏、转场、导演复刻都拆细
- 你接受等待数分钟

推荐命令：

```bash
python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_gemini_video_multiturn_analysis.py --video-path <本地 mp4 路径>
```

默认行为：

- 第一轮上传完整视频
- 优先使用 transcript 证据
- 在同一个 Gemini 会话里继续追问
- 输出：
  - `分析报告__gemini多轮增强__runtime.md`
  - `文案与讲解分析__runtime.md`
  - `节奏与转场分析__runtime.md`
  - `导演复刻建议__runtime.md`
  - `gemini_multiturn_video_analysis_raw.json`
  - `prompt_rounds.json`

使用建议：

- 高深度：用这条多轮 Pro 链
- 高稳定、快一些：用关键帧增强链

注意：

- 如果环境里没有 `OPENAI_API_KEY`，脚本会尝试读取已有 transcript；没有时会降级，但不会伪造文案判断
- 这条链不适合作为批量账号样本的默认分析方法

## 11. 出问题时怎么排查

### 页面打不开

先看：

- `http://127.0.0.1:3000/api/health`

如果不通，说明 broker 没起来。

### 导出 bundle 失败

看这些地方：

- broker 是否已经启动
- 当前节点是否为 Level 3 SOP
- `exports/bundles/` 是否可写
- `scripts/export_sop_bundle.py` 是否能单独运行

### 点了 SOP 没结果

看：

- 输入是否填了
- Recent 是否有新任务
- 任务是 `queued`、`running` 还是 `failed`

### 知识文档打不开

检查是否是：

- `/api/v1/doc?path=...`

或：

- `/api/v1/qmd-doc?ref=...`

而不是直接把本地路径当网页地址打开。

## 12. 用户最少需要掌握的操作

如果只记一套最小操作流程，记这个：

1. 打开 `127.0.0.1:3000`
2. 展开技能树
3. 点开 SOP
4. 填参数
5. 执行
6. 看 Recent
7. 看知识回写

这就是当前最实用的使用路径。

## 13. 飞书连接并发布应用

如果你要先把飞书应用接起来，再开始正式使用，当前确认过的顺序是：

1. 打开飞书开发者后台
2. 配置事件与回调
3. 订阅方式选择 `长连接接收事件`
4. 保存
5. 添加事件
6. `通讯录相关` 全部打勾
7. `消息与群组` 中勾选：
   - 接收消息
   - 机器人进群
8. 保存确认
9. 返回开发者后台创建版本
10. 版本号填 `1.0.0`
11. 更新说明随便写一版即可
12. 保存并确认发布
13. 打开飞书 App
14. 找到应用审批通过通知
15. 打开应用开始对话

不要跳过这两步：

- `长连接接收事件`
- `创建版本 -> 发布`

## 14. 打包本地发布

需要把整个控制台和核心文档打包出来时，运行：

```bash
npm run package
```

`scripts/package_release.py` 会先重新生成 `dist/`（相当于 `npm run build`），然后把生产 UI 和两个主要文档 (`README.md` 与 `USER_MANUAL.md`) 复制到 `releases/release-v<version>-<YYYYMMDD>` 目录，并在相同目录再写一个 `release-v<version>-<YYYYMMDD>.zip` 打包文件。把这个目录或 ZIP 直接发给发布伙伴，就能保证本地部署包里既有界面构建产物也有必备的用户手册。
