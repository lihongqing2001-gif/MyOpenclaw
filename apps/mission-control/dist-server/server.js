// server.ts
import express from "express";
import { spawn, spawnSync } from "node:child_process";
import fs7 from "node:fs";
import os3 from "node:os";
import path7 from "node:path";
import crypto2 from "node:crypto";

// src/data/mockKnowledge.ts
var seedKnowledgeBase = [
  {
    id: "kb_20260306_001",
    human: {
      title: "AI\u63D0\u6548\uFF1A\u5C0F\u7EA2\u4E66\u9009\u9898\u6A21\u677F",
      summary: "\u9002\u7528\u4E8EAI\u6548\u7387\u7C7B\u5185\u5BB9\uFF0C\u5305\u542B\u7206\u6B3E\u6807\u9898\u516C\u5F0F\u4E0E\u7F51\u611F\u6392\u7248\u6307\u5357\u3002",
      content_md: "# AI\u63D0\u6548\uFF1A\u5C0F\u7EA2\u4E66\u9009\u9898\u6A21\u677F\n\n## \u6838\u5FC3\u903B\u8F91\n1. \u75DB\u70B9\u524D\u7F6E\n2. \u89E3\u51B3\u65B9\u6848\n3. \u60C5\u7EEA\u4EF7\u503C",
      tags: ["AI\u6548\u7387", "\u9009\u9898", "\u7206\u6B3E"],
      domain: "AI\u6548\u7387",
      platform: "\u5C0F\u7EA2\u4E66"
    },
    machine: {
      intent: "content_ideation",
      entities: { topic: "AI\u63D0\u6548" },
      steps: ["\u68C0\u7D22\u70ED\u8BCD", "\u751F\u6210\u6807\u9898", "\u8F93\u51FA\u5927\u7EB2"],
      commands: ["/content run --style xiaogai --count 1"],
      constraints: ["\u539A\u7248700-1000\u5B57", "\u5E26emoji"],
      trigger: { type: "cron", schedule: "0 9 * * *" }
    }
  },
  {
    id: "kb_20260306_002",
    human: {
      title: "\u91D1\u878D\u98CE\u63A7\uFF1A\u6781\u7AEF\u884C\u60C5\u76D1\u63A7\u7B56\u7565",
      summary: "\u5F53\u5E02\u573A\u6CE2\u52A8\u7387\u8D85\u8FC7\u9608\u503C\u65F6\uFF0C\u81EA\u52A8\u89E6\u53D1\u98CE\u63A7\u8B66\u62A5\u5E76\u5E73\u4ED3\u3002",
      content_md: "# \u6781\u7AEF\u884C\u60C5\u76D1\u63A7\u7B56\u7565\n\n## \u89E6\u53D1\u6761\u4EF6\n- 5\u5206\u949F\u5185\u6CE2\u52A8 > 5%\n- \u8D44\u91D1\u51C0\u6D41\u51FA > 1000\u4E07",
      tags: ["\u91CF\u5316\u4EA4\u6613", "\u98CE\u63A7", "\u9884\u8B66"],
      domain: "\u91D1\u878D\u98CE\u63A7",
      platform: "Telegram"
    },
    machine: {
      intent: "risk_management",
      entities: { threshold: "5%" },
      steps: ["\u83B7\u53D6\u5B9E\u65F6K\u7EBF", "\u8BA1\u7B97\u6CE2\u52A8\u7387", "\u53D1\u9001\u8B66\u62A5"],
      commands: ["/risk monitor --asset BTC --threshold 0.05"],
      constraints: ["\u5EF6\u8FDF<100ms"]
    }
  }
];

// src/data/mockData.ts
var mockSkillNodes = [
  // Level 1: Main Branches
  { id: "l1-self-management", level: 1, label: "\u81EA\u6211\u7BA1\u7406", status: "idle", parentId: null },
  { id: "l1-media-automation", level: 1, label: "\u81EA\u5A92\u4F53\u81EA\u52A8\u5316\u4E0E\u5185\u5BB9\u6D1E\u5BDF", status: "running", parentId: null },
  { id: "l1-research", level: 1, label: "\u79D1\u7814\u9879\u76EE\u4E0E\u6267\u884C", status: "idle", parentId: null },
  { id: "l1-finance", level: 1, label: "\u91D1\u878D\u4FE1\u606F\u83B7\u53D6", status: "idle", parentId: null },
  { id: "l1-devops", level: 1, label: "DevOps\u4E0E\u81EA\u52A8\u5316\u90E8\u7F72", status: "error", parentId: null },
  { id: "l1-data-analysis", level: 1, label: "\u6570\u636E\u5206\u6790\u4E0E\u53EF\u89C6\u5316", status: "idle", parentId: null },
  { id: "l1-iot", level: 1, label: "IoT\u4E0E\u667A\u80FD\u5BB6\u5C45", status: "idle", parentId: null },
  { id: "l1-security", level: 1, label: "\u7F51\u7EDC\u5B89\u5168\u4E0E\u5BA1\u8BA1", status: "idle", parentId: null },
  // Level 2: Sub-categories
  // Self Management
  { id: "l2-task-tracking", level: 2, label: "\u4EFB\u52A1\u8FFD\u8E2A", status: "idle", parentId: "l1-self-management" },
  { id: "l2-habit-building", level: 2, label: "\u4E60\u60EF\u517B\u6210", status: "idle", parentId: "l1-self-management" },
  // Media Automation
  { id: "l2-content-generation", level: 2, label: "\u5185\u5BB9\u751F\u6210", status: "running", parentId: "l1-media-automation" },
  { id: "l2-social-listening", level: 2, label: "\u793E\u4EA4\u8046\u542C", status: "idle", parentId: "l1-media-automation" },
  // Research
  { id: "l2-literature-review", level: 2, label: "\u6587\u732E\u7EFC\u8FF0", status: "idle", parentId: "l1-research" },
  { id: "l2-experiment-tracking", level: 2, label: "\u5B9E\u9A8C\u8FFD\u8E2A", status: "idle", parentId: "l1-research" },
  // Finance
  { id: "l2-market-data", level: 2, label: "\u5E02\u573A\u6570\u636E", status: "idle", parentId: "l1-finance" },
  { id: "l2-portfolio-management", level: 2, label: "\u6295\u8D44\u7EC4\u5408", status: "idle", parentId: "l1-finance" },
  // DevOps
  { id: "l2-ci-cd", level: 2, label: "CI/CD \u6D41\u6C34\u7EBF", status: "error", parentId: "l1-devops" },
  // Level 3: Workflow Nodes
  // Content Generation
  {
    id: "l3-article-writer",
    level: 3,
    label: "AI \u7206\u6B3E\u6587\u7AE0\u751F\u6210\u5668",
    status: "running",
    parentId: "l2-content-generation",
    drawerContent: {
      invoke: "/content run --style xiaogai --count 1",
      commands: ["/content run --style xiaogai --count 1"],
      capabilities: ["\u591A\u5E73\u53F0\u98CE\u683C\u9002\u914D", "SEO \u5173\u952E\u8BCD\u4F18\u5316", "\u81EA\u52A8\u914D\u56FE\u751F\u6210"],
      useCases: [
        { title: "\u79D1\u6280\u535A\u4E3B\u65E5\u66F4", summary: "\u6BCF\u5929\u81EA\u52A8\u6293\u53D6\u6700\u65B0\u79D1\u6280\u65B0\u95FB\u5E76\u751F\u6210 1500 \u5B57\u6DF1\u5EA6\u5206\u6790\u6587\u7AE0\u3002" },
        { title: "\u5C0F\u7EA2\u4E66\u79CD\u8349\u6587", summary: "\u6839\u636E\u4EA7\u54C1\u5356\u70B9\uFF0C\u751F\u6210\u5E26\u6709 emoji \u548C\u7F51\u611F\u6392\u7248\u7684\u79CD\u8349\u7B14\u8BB0\u3002" }
      ],
      inputs: [
        { field: "\u4E3B\u9898\u5173\u952E\u8BCD", type: "text" },
        { field: "\u6587\u7AE0\u957F\u5EA6 (\u5B57\u6570)", type: "slider" },
        { field: "\u521B\u610F\u7A0B\u5EA6 (Temperature)", type: "slider" }
      ],
      knowledgeBase: {
        tags: ["\u5C0F\u7EA2\u4E66", "\u7206\u6B3E\u6587\u6848", "SEO"],
        documents: [
          { title: "\u5C0F\u7EA2\u4E66\u7206\u6B3E\u6807\u9898\u5E93.md", url: "#" },
          { title: "2025\u79D1\u6280\u5708\u70ED\u8BCD\u603B\u7ED3.pdf", url: "#" }
        ]
      }
    }
  },
  {
    id: "l3-video-script",
    level: 3,
    label: "\u77ED\u89C6\u9891\u811A\u672C\u7F16\u6392",
    status: "idle",
    parentId: "l2-content-generation",
    drawerContent: {
      invoke: '/video script --topic "AI\u79D1\u666E"',
      commands: ['/video script --topic "AI\u79D1\u666E"'],
      capabilities: ["\u5206\u955C\u5934\u811A\u672C\u751F\u6210", "\u7206\u6B3E\u5F00\u5934\u94A9\u5B50\u8BBE\u8BA1", "BGM \u63A8\u8350"],
      useCases: [
        { title: "\u77E5\u8BC6\u79D1\u666E\u77ED\u89C6\u9891", summary: "\u5C06\u590D\u6742\u7684\u5B66\u672F\u6982\u5FF5\u8F6C\u5316\u4E3A 1 \u5206\u949F\u7684\u901A\u4FD7\u6613\u61C2\u77ED\u89C6\u9891\u811A\u672C\u3002" }
      ],
      inputs: [
        { field: "\u6838\u5FC3\u6982\u5FF5", type: "text" },
        { field: "\u89C6\u9891\u65F6\u957F (\u79D2)", type: "slider" }
      ],
      knowledgeBase: {
        tags: ["\u77ED\u89C6\u9891", "\u811A\u672C\u6A21\u677F", "\u5B8C\u64AD\u7387"],
        documents: [
          { title: "\u9EC4\u91D1\u524D\u4E09\u79D2\u94A9\u5B50\u5E93.md", url: "#" },
          { title: "\u79D1\u666E\u7C7B\u89C6\u9891\u5206\u955C\u53C2\u8003.pdf", url: "#" }
        ]
      }
    }
  },
  // CI/CD
  {
    id: "l3-docker-build",
    level: 3,
    label: "Docker \u955C\u50CF\u6784\u5EFA",
    status: "error",
    parentId: "l2-ci-cd",
    drawerContent: {
      invoke: "/devops build --target docker",
      commands: ["/devops build --target docker"],
      capabilities: ["\u591A\u67B6\u6784\u955C\u50CF\u7F16\u8BD1", "\u5B89\u5168\u6F0F\u6D1E\u626B\u63CF", "\u81EA\u52A8\u63A8\u9001\u5230 Registry"],
      useCases: [
        { title: "\u5FAE\u670D\u52A1\u81EA\u52A8\u90E8\u7F72", summary: "\u4EE3\u7801\u5408\u5E76\u5230 main \u5206\u652F\u540E\uFF0C\u81EA\u52A8\u89E6\u53D1\u6784\u5EFA\u5E76\u90E8\u7F72\u5230 K8s \u96C6\u7FA4\u3002" }
      ],
      inputs: [
        { field: "Dockerfile \u8DEF\u5F84", type: "text" },
        { field: "\u955C\u50CF\u6807\u7B7E", type: "text" }
      ],
      knowledgeBase: {
        tags: ["DevOps", "Docker", "CI/CD"],
        documents: [
          { title: "\u516C\u53F8\u5185\u90E8\u955C\u50CF\u6784\u5EFA\u89C4\u8303.md", url: "#" },
          { title: "\u5E38\u89C1\u5B89\u5168\u6F0F\u6D1E\u4FEE\u590D\u6307\u5357.pdf", url: "#" }
        ]
      }
    }
  },
  // Market Data
  {
    id: "l3-crypto-tracker",
    level: 3,
    label: "\u52A0\u5BC6\u8D27\u5E01\u5F02\u52A8\u76D1\u63A7",
    status: "idle",
    parentId: "l2-market-data",
    drawerContent: {
      invoke: "/risk monitor --asset BTC --threshold 0.05",
      commands: ["/risk monitor --asset BTC --threshold 0.05"],
      capabilities: ["\u5DE8\u9CB8\u94B1\u5305\u8FFD\u8E2A", "\u4EA4\u6613\u6240\u8D44\u91D1\u51C0\u6D41\u5165/\u6D41\u51FA", "\u793E\u4EA4\u5A92\u4F53\u60C5\u7EEA\u5206\u6790"],
      useCases: [
        { title: "\u9AD8\u9891\u4EA4\u6613\u4FE1\u53F7", summary: "\u5F53\u67D0\u4EE3\u5E01\u5728 5 \u5206\u949F\u5185\u4EA4\u6613\u91CF\u6FC0\u589E 500% \u65F6\uFF0C\u81EA\u52A8\u53D1\u9001 Telegram \u8B66\u62A5\u3002" }
      ],
      inputs: [
        { field: "\u76D1\u63A7\u5E01\u79CD (\u5982 BTC, ETH)", type: "text" },
        { field: "\u62A5\u8B66\u9608\u503C (%)", type: "slider" }
      ],
      knowledgeBase: {
        tags: ["\u91CF\u5316\u4EA4\u6613", "\u94FE\u4E0A\u6570\u636E", "\u98CE\u63A7"],
        documents: [
          { title: "\u5DE8\u9CB8\u5730\u5740\u76D1\u63A7\u5217\u8868.csv", url: "#" },
          { title: "\u6781\u7AEF\u884C\u60C5\u98CE\u63A7\u7B56\u7565.md", url: "#" }
        ]
      }
    }
  }
];

// src/server/agentOsConfig.ts
import fs2 from "node:fs";
import os from "node:os";
import path2 from "node:path";

// src/server/workspaceTopology.ts
import fs from "node:fs";
import path from "node:path";
var topologyPath = process.env.OPENCLAW_TOPOLOGY_PATH ? path.resolve(process.env.OPENCLAW_TOPOLOGY_PATH) : path.resolve(process.cwd(), "..", "..", "workspace-topology.json");
var cachedTopology = null;
function loadTopology() {
  if (cachedTopology) {
    return cachedTopology;
  }
  if (!fs.existsSync(topologyPath)) {
    throw new Error(`workspace-topology.json not found: ${topologyPath}`);
  }
  const payload = JSON.parse(fs.readFileSync(topologyPath, "utf-8"));
  cachedTopology = payload;
  return payload;
}
function getRepoRoot() {
  return loadTopology().repoRoot;
}
function getRuntimeRoot() {
  return loadTopology().runtimeRoot;
}

// src/server/agentOsConfig.ts
var homeDir = os.homedir();
var runtimeAgentsRoot = path2.join(getRuntimeRoot(), "agent");
var runtimeConfigFile = "agent-os-config-v1.json";
var runtimeConfigPath = path2.join(runtimeAgentsRoot, runtimeConfigFile);
var defaultAssetRoot = path2.join(homeDir, "Documents", "mission-control-assets");
var DEFAULT_NAMING_CONTRACT = {
  typePrefixes: {
    plan: "PLN",
    document: "DOC",
    concept: "CPT",
    dataset: "DATA",
    model: "MOD",
    "runtime-evidence": "EVD"
  },
  humanAiPairGuidance: {
    separator: "__",
    humanSuffix: "human",
    aiSuffix: "ai",
    description: "Name human/AI pairs using the same base plus the separator and role suffix (e.g., `topic__human` and `topic__ai`)."
  },
  statusLabels: {
    draft: "draft",
    review: "review",
    final: "final"
  },
  dateFormat: "YYYYMMDD",
  versionPattern: "v{major}.{minor}",
  draftSuffix: "-draft",
  finalSuffix: "-final"
};
function ensureRuntimeDir() {
  if (!fs2.existsSync(runtimeAgentsRoot)) {
    fs2.mkdirSync(runtimeAgentsRoot, { recursive: true });
  }
}
function resolveAssetRoot(rawPath) {
  if (!rawPath) {
    return defaultAssetRoot;
  }
  return path2.resolve(rawPath);
}
function sanitizeConfig(raw) {
  return {
    assetRootPath: resolveAssetRoot(raw.assetRootPath),
    namingContract: raw.namingContract ?? DEFAULT_NAMING_CONTRACT,
    createdAt: raw.createdAt,
    lastUpdatedAt: raw.lastUpdatedAt
  };
}
function getAssetRootConfigPath() {
  return runtimeConfigPath;
}
function getSuggestedAssetRootPath() {
  return defaultAssetRoot;
}
function readAgentOsConfig() {
  const base = {
    assetRootPath: defaultAssetRoot,
    namingContract: DEFAULT_NAMING_CONTRACT,
    createdAt: void 0,
    lastUpdatedAt: void 0
  };
  if (!fs2.existsSync(runtimeConfigPath)) {
    return base;
  }
  try {
    const raw = JSON.parse(fs2.readFileSync(runtimeConfigPath, "utf-8"));
    const sanitized = sanitizeConfig({
      ...base,
      ...raw
    });
    return {
      ...sanitized,
      createdAt: raw.createdAt ?? base.createdAt,
      lastUpdatedAt: raw.lastUpdatedAt ?? base.lastUpdatedAt
    };
  } catch (error) {
    return base;
  }
}
function updateAgentOsConfig(partial) {
  const current = readAgentOsConfig();
  const merged = {
    ...current,
    ...partial,
    assetRootPath: resolveAssetRoot(partial.assetRootPath ?? current.assetRootPath),
    namingContract: partial.namingContract ?? current.namingContract,
    lastUpdatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    createdAt: current.createdAt ?? (/* @__PURE__ */ new Date()).toISOString()
  };
  ensureRuntimeDir();
  fs2.writeFileSync(runtimeConfigPath, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}
function getNamingContract() {
  return readAgentOsConfig().namingContract;
}
function isPathInsideAssetRoot(target, config) {
  const root = path2.resolve(config?.assetRootPath ?? readAgentOsConfig().assetRootPath);
  const candidate = path2.resolve(target);
  return candidate === root || candidate.startsWith(root + path2.sep);
}

// src/server/decisionQueue.ts
var STALE_EVIDENCE_MS = 1e3 * 60 * 60 * 24;
function buildDecisionId(kind, taskId) {
  return `${kind}:${taskId ?? Math.random().toString(36).slice(2, 8)}`;
}
function makeDecisionItem(input) {
  return {
    id: buildDecisionId(input.kind, input.refs?.[0]),
    priority: input.priority,
    reason: input.reason,
    nextAction: input.nextAction,
    refs: input.refs,
    metadata: input.metadata
  };
}
function parseTimestamp(value) {
  if (!value) {
    return null;
  }
  const numeric = Date.parse(value);
  return Number.isFinite(numeric) ? numeric : null;
}
function isEvidenceStale(evidence) {
  if (evidence?.needsRefresh) {
    return true;
  }
  const lastConfirmed = parseTimestamp(evidence?.lastConfirmedAt);
  if (!lastConfirmed) {
    return true;
  }
  return Date.now() - lastConfirmed > STALE_EVIDENCE_MS;
}
function buildBlockedDecision(task) {
  const title = task.title ? `${task.title}` : "Unnamed task";
  const reason = task.blockReason ? `${title} is blocked: ${task.blockReason}` : `${title} is currently blocked.`;
  return makeDecisionItem({
    kind: "blocked",
    priority: "urgent",
    reason,
    nextAction: "Resolve blocker, escalate to the relevant owner, and unlock downstream steps.",
    refs: task.id ? [task.id] : void 0
  });
}
function buildMissingAssetRootDecision(task, knowledge) {
  const assetPath = task.assetState?.path ?? knowledge.asset?.path ?? "(not configured)";
  return makeDecisionItem({
    kind: "asset-root",
    priority: "high",
    reason: `Required asset root is missing or unverified (${assetPath}).`,
    nextAction: "Set or confirm the asset root before provisioning new artifacts.",
    refs: task.id ? [task.id] : void 0,
    metadata: { path: assetPath }
  });
}
function buildStaleEvidenceDecision(task, knowledge) {
  const evidenceSource = task.evidence ?? knowledge.evidence;
  return makeDecisionItem({
    kind: "evidence-stale",
    priority: "high",
    reason: evidenceSource?.summary ? `Runtime evidence is stale: ${evidenceSource.summary}` : "Runtime evidence has not been confirmed recently.",
    nextAction: "Refresh or re-validate runtime evidence to regain confidence.",
    refs: task.id ? [task.id] : void 0
  });
}
function buildFailureClusterDecision(task) {
  const cluster = task.failureCluster;
  const count = cluster?.count ?? 0;
  const reason = cluster?.latestError ? `Failure cluster detected (${count} hits): ${cluster.latestError}` : `Failure cluster detected (${count} hits).`;
  return makeDecisionItem({
    kind: "failure-cluster",
    priority: "medium",
    reason,
    nextAction: "Investigate the recurring errors, pause automatic retries, and capture fresh diagnostics.",
    refs: cluster?.id ? [cluster.id] : task.id ? [task.id] : void 0,
    metadata: {
      count: `${count}`,
      windowMinutes: cluster?.windowMinutes?.toString() ?? ""
    }
  });
}
function buildFollowUpDecision(task) {
  const followUp = task.followUp;
  const reason = followUp?.reason ? `Follow-up queued: ${followUp.reason}` : "Intake follow-up request is waiting.";
  return makeDecisionItem({
    kind: "follow-up",
    priority: "medium",
    reason,
    nextAction: "Engage the queued contact and log the outcome as soon as possible.",
    refs: task.id ? [task.id] : void 0,
    metadata: {
      owner: followUp?.owner ?? "",
      eta: followUp?.eta ?? ""
    }
  });
}
function deriveDecisionQueue(task = {}, knowledge = {}) {
  const decisions = [];
  if (task.blocked) {
    decisions.push(buildBlockedDecision(task));
  }
  const assetConfigured = task.assetState?.configured ?? knowledge.asset?.configured;
  if (assetConfigured === false) {
    decisions.push(buildMissingAssetRootDecision(task, knowledge));
  }
  if (isEvidenceStale(task.evidence ?? knowledge.evidence)) {
    decisions.push(buildStaleEvidenceDecision(task, knowledge));
  }
  const failures = task.failureCluster?.count ?? 0;
  if (failures >= 3) {
    decisions.push(buildFailureClusterDecision(task));
  }
  if (task.followUp?.queued) {
    decisions.push(buildFollowUpDecision(task));
  }
  return decisions;
}
function summarizeDecisions(decisions) {
  if (!decisions.length) {
    return "Decision queue is clear.";
  }
  return decisions.map((decision) => `${decision.priority.toUpperCase()}: ${decision.reason}`).join("; ");
}

// src/server/knowledgeLoader.ts
import fs4 from "node:fs";
import path4 from "node:path";

// src/server/skillIndex.ts
import fs3 from "node:fs";
import os2 from "node:os";
import path3 from "node:path";
var homeDir2 = os2.homedir();
var SKILL_ROOTS = [
  {
    root: path3.join(homeDir2, ".openclaw", "workspace", "skills"),
    scope: "workspace",
    priority: 0,
    scopeLabel: "Workspace Skill"
  },
  {
    root: path3.join(homeDir2, ".agents", "skills"),
    scope: "global",
    priority: 1,
    scopeLabel: "Global Skill"
  },
  {
    root: path3.join(homeDir2, ".codex", "skills"),
    scope: "system",
    priority: 2,
    scopeLabel: "System Skill"
  }
];
var IGNORED_DIRS = /* @__PURE__ */ new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "dist",
  "build",
  "__pycache__",
  ".venv",
  "venv"
]);
function exists(targetPath) {
  return fs3.existsSync(targetPath);
}
function readTextIfExists(targetPath) {
  if (!exists(targetPath)) {
    return null;
  }
  return fs3.readFileSync(targetPath, "utf-8");
}
function firstHeading(markdown) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
}
function firstParagraph(markdown) {
  return markdown.replace(/^---[\s\S]*?---/, "").split("\n").map((line) => line.trim()).filter(Boolean).find((line) => !line.startsWith("#") && !line.startsWith("```")) ?? null;
}
function extractSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `^##+\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##+\\s+|\\Z)`,
    "mi"
  );
  return markdown.match(regex)?.[1]?.trim() ?? "";
}
function extractBulletLines(sectionContent) {
  return [...new Set(
    sectionContent.split("\n").map((line) => line.trim()).filter((line) => /^[-*]\s+/.test(line)).map((line) => line.replace(/^[-*]\s+/, "").trim()).filter(Boolean)
  )];
}
function extractCommands(text) {
  const commands = /* @__PURE__ */ new Set();
  for (const match of text.matchAll(/`([^`]+)`/g)) {
    const candidate = match[1].trim();
    if (/^\/[a-z0-9_-]+(?:\s|$)/i.test(candidate) || candidate.startsWith("python ") || candidate.startsWith("python3 ") || candidate.startsWith("npm ") || candidate.startsWith("node ") || candidate.startsWith("uv ") || candidate.startsWith("claw ")) {
      commands.add(candidate);
    }
  }
  return [...commands];
}
function extractExternalLink(markdown) {
  return markdown.match(/\[(?:[^\]]+)\]\((https?:\/\/[^)]+)\)/)?.[1];
}
function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return {};
  }
  const result = {};
  for (const line of match[1].split("\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    result[key] = value.replace(/^['"]|['"]$/g, "");
  }
  return result;
}
function walkSkillDirectories(root) {
  if (!exists(root)) {
    return [];
  }
  const results = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs3.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    if (entries.some((entry) => entry.isFile() && entry.name === "SKILL.md")) {
      results.push(current);
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      stack.push(path3.join(current, entry.name));
    }
  }
  return results.sort();
}
function unique(items) {
  return [...new Set(items.filter(Boolean))];
}
function getSkillSourceRoots() {
  return SKILL_ROOTS.map((item) => item.root).filter(exists);
}
function listIndexedSkills() {
  const indexed = /* @__PURE__ */ new Map();
  const ignoredTokens = /* @__PURE__ */ new Set([
    "skill",
    "skills",
    "agent",
    "wrap",
    "plus",
    "auto",
    "openclaw"
  ]);
  for (const source of SKILL_ROOTS) {
    for (const dirPath of walkSkillDirectories(source.root)) {
      const skillPath = path3.join(dirPath, "SKILL.md");
      const readmePath = path3.join(dirPath, "README.md");
      const skillMarkdown = readTextIfExists(skillPath);
      if (!skillMarkdown) {
        continue;
      }
      const readmeMarkdown = readTextIfExists(readmePath) ?? "";
      const frontmatter = parseFrontmatter(skillMarkdown);
      const dirName = path3.basename(dirPath);
      const label = frontmatter.name || firstHeading(skillMarkdown) || dirName;
      const summary = frontmatter.description || firstParagraph(skillMarkdown) || `${source.scopeLabel} indexed by OpenClaw.`;
      const features = extractBulletLines(
        extractSection(skillMarkdown, "Key Features") || extractSection(skillMarkdown, "Features") || extractSection(skillMarkdown, "What Makes This Different?")
      );
      const useCases = extractBulletLines(extractSection(skillMarkdown, "Use Cases"));
      const commands = extractCommands(`${skillMarkdown}
${readmeMarkdown}`);
      const installUrl = extractExternalLink(`${skillMarkdown}
${readmeMarkdown}`);
      const matchTokens = unique([
        dirName.toLowerCase(),
        label.toLowerCase(),
        ...dirName.split(/[-_]/).map((token) => token.toLowerCase()).filter((token) => token.length >= 4 && !ignoredTokens.has(token))
      ]);
      const record = {
        dirName,
        label,
        summary,
        features,
        useCases,
        commands,
        installUrl: installUrl || void 0,
        skillPath,
        readmePath: exists(readmePath) ? readmePath : void 0,
        scope: source.scope,
        scopeLabel: source.scopeLabel,
        matchTokens
      };
      const key = dirName.toLowerCase();
      const previous = indexed.get(key);
      if (!previous || source.priority < previous.priority) {
        indexed.set(key, {
          priority: source.priority,
          record
        });
      }
    }
  }
  return [...indexed.values()].map((item) => item.record).sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN"));
}

// src/server/knowledgeLoader.ts
var workspaceRoot = getRepoRoot();
var contentSkillTreePath = path4.join(
  workspaceRoot,
  "content_system",
  "skilltree",
  "data.json"
);
var sopsRoot = path4.join(workspaceRoot, "sops");
var agentsKnowledgeRoot = path4.join(workspaceRoot, "agents", "knowledge");
var libraryRoot = path4.resolve(readAgentOsConfig().assetRootPath);
var externalKnowledgeRoot = path4.join(libraryRoot, "knowledge");
function toDocUrl(targetPath) {
  if (!targetPath) {
    return "#";
  }
  if (/^https?:\/\//i.test(targetPath)) {
    return targetPath;
  }
  return `/api/v1/doc?path=${encodeURIComponent(targetPath)}`;
}
function exists2(targetPath) {
  return fs4.existsSync(targetPath);
}
function readTextIfExists2(targetPath) {
  if (!exists2(targetPath)) {
    return null;
  }
  return fs4.readFileSync(targetPath, "utf-8");
}
function firstHeading2(markdown) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
}
function firstParagraph2(markdown) {
  return markdown.replace(/^---[\s\S]*?---/, "").split("\n").map((line) => line.trim()).filter(Boolean).find((line) => !line.startsWith("#") && !line.startsWith("```")) ?? null;
}
function extractSection2(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `^##+\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##+\\s+|\\Z)`,
    "mi"
  );
  return markdown.match(regex)?.[1]?.trim() ?? "";
}
function extractBulletLines2(sectionContent) {
  return sectionContent.split("\n").map((line) => line.trim()).filter((line) => /^[-*]\s+/.test(line)).map((line) => line.replace(/^[-*]\s+/, "").trim()).filter(Boolean);
}
function extractCommands2(text) {
  const commands = /* @__PURE__ */ new Set();
  for (const match of text.matchAll(/`([^`]+)`/g)) {
    const candidate = match[1].trim();
    if (/^\/[a-z0-9_-]+(?:\s|$)/i.test(candidate) || candidate.startsWith("python ") || candidate.startsWith("python3 ") || candidate.startsWith("npm ") || candidate.startsWith("node ") || candidate.startsWith("claw ")) {
      commands.add(candidate);
    }
  }
  return [...commands];
}
function extractExternalLinks(markdown) {
  const links = [];
  for (const match of markdown.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)) {
    links.push({ title: match[1], url: match[2] });
  }
  return links;
}
function parseFrontmatter2(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return {};
  }
  const result = {};
  for (const line of match[1].split("\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    result[key] = value.replace(/^['"]|['"]$/g, "");
  }
  return result;
}
function evidenceFromFrontmatter(frontmatter) {
  const raw = frontmatter.evidence?.trim().toLowerCase();
  if (raw === "confirmed") {
    return "confirmed";
  }
  if (raw === "runtime" || raw === "human-feedback") {
    return "runtime";
  }
  return "declared";
}
function knowledgeTypeFromAgentPath(relativePath, frontmatter) {
  const explicit = frontmatter.knowledge_type?.trim().toLowerCase();
  if (explicit === "case-study" || explicit === "runtime-lesson" || explicit === "feedback" || explicit === "asset-index") {
    return explicit;
  }
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.startsWith("cases/")) {
    return "case-study";
  }
  if (normalized.startsWith("runtime-lessons/")) {
    return "runtime-lesson";
  }
  if (normalized.startsWith("feedback/")) {
    return "feedback";
  }
  return "agent-knowledge";
}
function sourceKindFromKnowledgeType(type) {
  if (type === "case-study" || type === "runtime-lesson" || type === "asset-index") {
    return "runtime";
  }
  if (type === "feedback") {
    return "feedback";
  }
  if (type === "qmd-result") {
    return "index";
  }
  return "reference";
}
function readContentSystemNodes() {
  if (!exists2(contentSkillTreePath)) {
    return [];
  }
  const raw = JSON.parse(fs4.readFileSync(contentSkillTreePath, "utf-8"));
  return raw.nodes ?? [];
}
function readSopFiles() {
  if (!exists2(sopsRoot)) {
    return [];
  }
  return fs4.readdirSync(sopsRoot, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md")).map((entry) => path4.join(sopsRoot, entry.name));
}
function readAgentKnowledgeFiles() {
  if (!exists2(agentsKnowledgeRoot)) {
    return [];
  }
  const files = [];
  const walk = (dir) => {
    for (const entry of fs4.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path4.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md") && !entry.name.startsWith("._")) {
        files.push(fullPath);
      }
    }
  };
  walk(agentsKnowledgeRoot);
  return files.sort();
}
function readExternalKnowledgeFiles() {
  if (!exists2(externalKnowledgeRoot)) {
    return [];
  }
  const files = [];
  const includeRoots = [
    path4.join(externalKnowledgeRoot, "projects"),
    path4.join(externalKnowledgeRoot, "shared"),
    path4.join(externalKnowledgeRoot, "_taxonomy")
  ];
  const walk = (dir) => {
    if (!exists2(dir)) {
      return;
    }
    for (const entry of fs4.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path4.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md") && !entry.name.startsWith("._")) {
        files.push(fullPath);
      }
    }
  };
  includeRoots.forEach(walk);
  return files.sort();
}
function buildAgentKnowledge() {
  return readAgentKnowledgeFiles().map((docPath) => {
    const markdown = readTextIfExists2(docPath) ?? "";
    const frontmatter = parseFrontmatter2(markdown);
    const title = firstHeading2(markdown)?.replace(/^#\s*/, "") || path4.basename(docPath, ".md");
    const summary = firstParagraph2(markdown) || "Agent knowledge document";
    const relative = path4.relative(agentsKnowledgeRoot, docPath);
    const pathParts = relative.split(path4.sep);
    const topLevel = pathParts[0] || "agents-knowledge";
    const commands = extractCommands2(markdown);
    const externalLinks = extractExternalLinks(markdown);
    const examples = extractBulletLines2(extractSection2(markdown, "Examples")).map(
      (item) => ({
        title: item,
        summary: `${title} example`
      })
    );
    const knowledgeType = knowledgeTypeFromAgentPath(relative, frontmatter);
    const evidenceLevel = evidenceFromFrontmatter(frontmatter);
    return {
      id: `kb-agent-${relative.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`,
      evidenceLevel,
      knowledgeType,
      sourceKind: sourceKindFromKnowledgeType(knowledgeType),
      updatedAt: frontmatter.updated_at,
      human: {
        title,
        summary,
        content_md: markdown.slice(0, 6e3),
        tags: ["agent-knowledge", topLevel, ...pathParts.slice(1, -1)].filter(Boolean),
        domain: "Agents Knowledge",
        platform: topLevel,
        links: [{ title: relative, url: toDocUrl(docPath) }, ...externalLinks],
        examples
      },
      machine: {
        intent: "agent_knowledge",
        entities: { docPath, relativePath: relative },
        steps: extractBulletLines2(extractSection2(markdown, "Steps")),
        commands,
        constraints: extractBulletLines2(extractSection2(markdown, "Constraints"))
      }
    };
  });
}
function buildExternalLibraryKnowledge() {
  return readExternalKnowledgeFiles().map((docPath) => {
    const markdown = readTextIfExists2(docPath) ?? "";
    const frontmatter = parseFrontmatter2(markdown);
    const title = firstHeading2(markdown)?.replace(/^#\s*/, "") || path4.basename(docPath, ".md");
    const summary = firstParagraph2(markdown) || "External library knowledge document";
    const relative = path4.relative(externalKnowledgeRoot, docPath);
    const knowledgeType = knowledgeTypeFromAgentPath(relative, frontmatter);
    const evidenceLevel = evidenceFromFrontmatter(frontmatter);
    return {
      id: `kb-library-${relative.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`,
      evidenceLevel,
      knowledgeType,
      sourceKind: sourceKindFromKnowledgeType(knowledgeType),
      updatedAt: frontmatter.updated_at,
      human: {
        title,
        summary,
        content_md: markdown.slice(0, 6e3),
        tags: ["ai-library", ...relative.split(path4.sep).slice(0, -1)].filter(Boolean),
        domain: "AI Library",
        platform: "External Knowledge Library",
        links: [{ title: relative, url: toDocUrl(docPath) }],
        examples: []
      },
      machine: {
        intent: "external_library_knowledge",
        entities: { docPath, relativePath: relative },
        steps: extractBulletLines2(extractSection2(markdown, "Steps")),
        commands: extractCommands2(markdown),
        constraints: extractBulletLines2(extractSection2(markdown, "Constraints"))
      }
    };
  });
}
function buildContentKnowledge() {
  return readContentSystemNodes().map((item) => ({
    id: `kb-content-${item.id}`,
    evidenceLevel: "declared",
    knowledgeType: "content-reference",
    sourceKind: "reference",
    human: {
      title: item.title,
      summary: item.applications?.trim() || item.functions?.trim() || "Content workflow",
      content_md: [
        `# ${item.title}`,
        item.prerequisites ? `
## Preconditions
${item.prerequisites}` : "",
        item.functions ? `
## Functions
${item.functions}` : "",
        item.applications ? `
## Applications
${item.applications}` : "",
        item.invoke ? `
## Invoke
${item.invoke}` : ""
      ].join("\n"),
      tags: [item.category, item.subcategory, item.level, item.nodeType].filter(Boolean),
      domain: item.category || "Content",
      platform: "OpenClaw Content System",
      links: (item.portfolio ?? []).map((doc) => ({
        title: doc.title || "Portfolio",
        url: toDocUrl(doc.path)
      })),
      examples: (item.portfolio ?? []).map((doc) => ({
        title: doc.title || "Portfolio",
        summary: `${item.title} \u793A\u4F8B\u8D44\u6599`,
        url: toDocUrl(doc.path)
      }))
    },
    machine: {
      intent: "content_workflow",
      entities: { nodeId: item.id },
      steps: item.functions ? item.functions.split("\u2192").map((step) => step.trim()).filter(Boolean) : [],
      commands: item.invoke ? extractCommands2(item.invoke) : [],
      constraints: item.prerequisites ? [item.prerequisites] : []
    }
  }));
}
function buildSkillKnowledge() {
  const skills = listIndexedSkills();
  const scopeCounts = skills.reduce((acc, skill) => {
    acc[skill.scope] = (acc[skill.scope] ?? 0) + 1;
    return acc;
  }, {});
  const indexItem = skills.length === 0 ? [] : [
    {
      id: "kb-skill-index-global",
      evidenceLevel: "declared",
      knowledgeType: "skill-reference",
      sourceKind: "reference",
      human: {
        title: "Global Skills Index",
        summary: `Indexed ${skills.length} skills across workspace, global, and system roots.`,
        content_md: [
          "# Global Skills Index",
          "",
          `- Workspace: ${scopeCounts.workspace ?? 0}`,
          `- Global: ${scopeCounts.global ?? 0}`,
          `- System: ${scopeCounts.system ?? 0}`,
          "",
          "## Skills",
          ...skills.map(
            (skill) => `- ${skill.label} [${skill.scope}] :: ${skill.summary}`
          )
        ].join("\n"),
        tags: ["skill-index", "global-skills", "skills"],
        domain: "Skills",
        platform: "Unified Skill Index",
        links: skills.slice(0, 40).map((skill) => ({
          title: `${skill.label} (${skill.scope})`,
          url: toDocUrl(skill.skillPath)
        })),
        examples: []
      },
      machine: {
        intent: "skill_index",
        entities: {
          count: skills.length,
          scopes: scopeCounts
        },
        steps: skills.map((skill) => `${skill.label} (${skill.scope})`),
        commands: skills.flatMap((skill) => skill.commands).slice(0, 40),
        constraints: []
      }
    }
  ];
  return [
    ...indexItem,
    ...skills.map((skill) => {
      const skillMarkdown = readTextIfExists2(skill.skillPath) ?? "";
      const readmeMarkdown = skill.readmePath ? readTextIfExists2(skill.readmePath) ?? "" : "";
      const links = [
        { title: "SKILL.md", url: toDocUrl(skill.skillPath) },
        ...skill.readmePath ? [{ title: "README.md", url: toDocUrl(skill.readmePath) }] : [],
        ...extractExternalLinks(`${skillMarkdown}
${readmeMarkdown}`)
      ];
      return {
        id: `kb-skill-${skill.scope}-${skill.dirName}`,
        evidenceLevel: "declared",
        knowledgeType: "skill-reference",
        sourceKind: "reference",
        human: {
          title: skill.label,
          summary: skill.summary,
          content_md: [
            `# ${skill.label}`,
            "",
            `- Scope: ${skill.scope}`,
            `- Path: ${skill.skillPath}`,
            "",
            skill.summary,
            skill.features.length > 0 ? `
## Features
- ${skill.features.join("\n- ")}` : "",
            skill.useCases.length > 0 ? `
## Use Cases
- ${skill.useCases.join("\n- ")}` : ""
          ].join("\n"),
          tags: ["skill", skill.scope, skill.dirName],
          domain: "Skills",
          platform: skill.scopeLabel,
          links,
          examples: skill.useCases.map((item) => ({
            title: item,
            summary: `${skill.label} usage case`
          }))
        },
        machine: {
          intent: "skill_reference",
          entities: {
            skillDir: skill.dirName,
            scope: skill.scope,
            sourcePath: skill.skillPath
          },
          steps: skill.features,
          commands: skill.commands,
          constraints: []
        }
      };
    })
  ];
}
function buildSopKnowledge() {
  return readSopFiles().map((sopPath) => {
    const markdown = readTextIfExists2(sopPath) ?? "";
    const title = firstHeading2(markdown)?.replace(/^SOP:\s*/i, "") || path4.basename(sopPath, ".md");
    const summary = firstParagraph2(markdown) || "SOP workflow";
    const triggers = extractBulletLines2(extractSection2(markdown, "Default Trigger"));
    const steps = extractSection2(markdown, "Steps").split("\n").map((line) => line.trim()).filter((line) => /^\d+\)/.test(line)).map((line) => line.replace(/^\d+\)\s*/, "").trim());
    const constraints = extractBulletLines2(extractSection2(markdown, "Preconditions"));
    const commands = extractCommands2(markdown);
    return {
      id: `kb-sop-${path4.basename(sopPath, ".md")}`,
      evidenceLevel: "declared",
      knowledgeType: "sop-reference",
      sourceKind: "reference",
      human: {
        title,
        summary,
        content_md: markdown.slice(0, 6e3),
        tags: ["sop", path4.basename(sopPath, ".md")],
        domain: "SOP",
        platform: "OpenClaw Workflow",
        links: [{ title: path4.basename(sopPath), url: toDocUrl(sopPath) }],
        examples: triggers.map((item) => ({
          title: item,
          summary
        }))
      },
      machine: {
        intent: "sop_reference",
        entities: { sopPath },
        steps,
        commands,
        constraints
      }
    };
  });
}
function buildWorkspaceKnowledgeItems() {
  const items = [
    ...buildContentKnowledge(),
    ...buildSkillKnowledge(),
    ...buildSopKnowledge(),
    ...buildAgentKnowledge(),
    ...buildExternalLibraryKnowledge()
  ];
  const seen = /* @__PURE__ */ new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

// src/server/skillTreeLoader.ts
import fs6 from "node:fs";
import path6 from "node:path";
import { execFileSync } from "node:child_process";

// src/server/agentRouting.ts
import fs5 from "node:fs";
import path5 from "node:path";
var configPath = path5.join(process.cwd(), "agent-routing.config.json");
function unique2(items) {
  return [...new Set(items.filter(Boolean))];
}
function normalizedHaystack(input) {
  return [
    input.domain,
    input.area,
    input.label,
    input.summary ?? "",
    ...input.commands ?? [],
    input.sourceType ?? ""
  ].join(" ").toLowerCase();
}
function defaultRoute() {
  return {
    orchestrator: "main",
    preferredAgents: ["executor", "engineer", "designer"],
    reason: "main \u5148\u63A5\u5355\uFF0C\u518D\u6309\u4EFB\u52A1\u6027\u8D28\u628A\u5DE5\u4F5C\u5206\u6D3E\u7ED9\u6700\u5408\u9002\u7684\u4E13\u95E8 agent\u3002"
  };
}
function fallbackRoute(input) {
  const haystack = normalizedHaystack(input);
  if (haystack.includes("\u65E5\u8BB0") || haystack.includes("calendar") || haystack.includes("trip") || haystack.includes("reminder") || haystack.includes("\u4E2A\u4EBA\u7BA1\u7406") || haystack.includes("journal")) {
    return {
      orchestrator: "main",
      preferredAgents: ["life-assistant", "executor"],
      reason: "\u8FD9\u662F\u4E2A\u4EBA\u7BA1\u7406/\u65E5\u7A0B/\u65E5\u8BB0\u7C7B\u4EFB\u52A1\uFF0Cmain \u5E94\u4F18\u5148\u5206\u6D3E\u7ED9 life-assistant \u5904\u7406\uFF0C\u9700\u8981\u6267\u884C\u843D\u5730\u65F6\u518D\u501F\u52A9 executor\u3002"
    };
  }
  if (haystack.includes("\u5C0F\u7EA2\u4E66") || haystack.includes("xiaohongshu") || haystack.includes("xhs") || haystack.includes("\u5185\u5BB9") || haystack.includes("\u70ED\u70B9") || haystack.includes("\u6A21\u4EFF") || haystack.includes("\u8BC4\u8BBA") || haystack.includes("crawl")) {
    return {
      orchestrator: "main",
      preferredAgents: ["executor", "designer", "engineer"],
      reason: "\u8FD9\u662F\u5185\u5BB9/\u6293\u53D6/\u751F\u6210\u7C7B\u4EFB\u52A1\uFF0Cmain \u5E94\u5148\u8BA9 executor \u843D\u5730\u6267\u884C\uFF0C\u6D89\u53CA\u5448\u73B0\u4E0E\u5305\u88C5\u65F6\u518D\u8C03 designer\uFF0C\u786E\u6709\u5DE5\u7A0B\u6539\u9020\u518D\u8C03 engineer\u3002"
    };
  }
  if (haystack.includes("\u8BBE\u8BA1") || haystack.includes("ui") || haystack.includes("ux") || haystack.includes("dashboard") || haystack.includes("\u754C\u9762") || haystack.includes("\u4F53\u9A8C")) {
    return {
      orchestrator: "main",
      preferredAgents: ["designer", "engineer"],
      reason: "\u8FD9\u662F\u754C\u9762\u4E0E\u4F53\u9A8C\u7C7B\u4EFB\u52A1\uFF0Cmain \u5E94\u4F18\u5148\u8BA9 designer \u5B9A\u4E49\u4E0E\u8C03\u6574\u65B9\u6848\uFF0C\u5FC5\u8981\u65F6\u518D\u8BA9 engineer \u5B9E\u73B0\u3002"
    };
  }
  if (haystack.includes("\u5DE5\u7A0B") || haystack.includes("script") || haystack.includes("python") || haystack.includes("node ") || haystack.includes("\u5F52\u6863") || haystack.includes("\u7D22\u5F15") || haystack.includes("file")) {
    return {
      orchestrator: "main",
      preferredAgents: ["engineer", "executor"],
      reason: "\u8FD9\u662F\u5DE5\u7A0B/\u811A\u672C/\u6587\u4EF6\u5904\u7406\u7C7B\u4EFB\u52A1\uFF0Cmain \u5E94\u4F18\u5148\u5206\u6D3E\u7ED9 engineer\uFF0C\u6267\u884C\u91CF\u5927\u7684\u6B65\u9AA4\u518D\u4EA4 executor\u3002"
    };
  }
  return defaultRoute();
}
function loadRouteConfig() {
  if (!fs5.existsSync(configPath)) {
    return null;
  }
  try {
    const payload = JSON.parse(fs5.readFileSync(configPath, "utf-8"));
    if (!payload || typeof payload !== "object") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
function ruleMatches(input, rule) {
  const haystack = normalizedHaystack(input);
  const match = rule.match ?? {};
  const domainOk = !match.domains || match.domains.some((item) => input.domain.includes(item));
  const areaOk = !match.areas || match.areas.some((item) => input.area.includes(item));
  const sourceOk = !match.sourceTypes || match.sourceTypes.some((item) => (input.sourceType ?? "").includes(item));
  const labelOk = !match.labels || match.labels.some((item) => haystack.includes(item.toLowerCase()));
  return domainOk && areaOk && sourceOk && labelOk;
}
function resolveAgentRoute(input) {
  const config = loadRouteConfig();
  if (config) {
    for (const rule of config.rules ?? []) {
      if (ruleMatches(input, rule)) {
        return {
          orchestrator: rule.route.orchestrator || "main",
          preferredAgents: unique2(rule.route.preferredAgents ?? []),
          reason: rule.route.reason || defaultRoute().reason
        };
      }
    }
    return {
      orchestrator: config.default?.orchestrator || "main",
      preferredAgents: unique2(config.default?.preferredAgents ?? []),
      reason: config.default?.reason || defaultRoute().reason
    };
  }
  const fallback = fallbackRoute(input);
  return {
    orchestrator: fallback.orchestrator || "main",
    preferredAgents: unique2(fallback.preferredAgents ?? []),
    reason: fallback.reason || defaultRoute().reason
  };
}

// src/server/skillTreeLoader.ts
var CONTENT_DOMAIN = "\u793E\u4EA4\u5A92\u4F53\u4E0E\u5185\u5BB9";
var CONTENT_AREAS = ["\u5185\u5BB9\u91C7\u96C6", "\u5185\u5BB9\u6D1E\u5BDF", "\u5185\u5BB9\u6539\u5199", "\u5185\u5BB9\u751F\u4EA7", "\u53D1\u5E03\u4E0E\u590D\u76D8"];
var workspaceRoot2 = getRepoRoot();
var runtimeRoot = getRuntimeRoot();
var contentSkillTreePath2 = path6.join(
  workspaceRoot2,
  "content_system",
  "skilltree",
  "data.json"
);
var sopsRoot2 = path6.join(workspaceRoot2, "sops");
var runtimeEvidencePath = path6.join(
  runtimeRoot,
  "agent",
  "runtime-skill-evidence.json"
);
var appRoot = process.cwd();
var openclawChannelStatusCache = null;
function resolvePath(baseDir, targetPath) {
  if (!targetPath) {
    return "";
  }
  if (/^https?:\/\//i.test(targetPath)) {
    return targetPath;
  }
  return path6.isAbsolute(targetPath) ? targetPath : path6.resolve(baseDir, targetPath);
}
function toDocUrl2(baseDir, targetPath) {
  const resolved = resolvePath(baseDir, targetPath);
  if (!resolved) {
    return "#";
  }
  if (/^https?:\/\//i.test(resolved)) {
    return resolved;
  }
  return `/api/v1/doc?path=${encodeURIComponent(resolved)}`;
}
function exists3(targetPath) {
  return fs6.existsSync(targetPath);
}
function slugify(input) {
  return input.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
function unique3(items) {
  return [...new Set(items)];
}
function readTextIfExists3(targetPath) {
  if (!exists3(targetPath)) {
    return null;
  }
  return fs6.readFileSync(targetPath, "utf-8");
}
function readRuntimeSkillEvidence() {
  if (!exists3(runtimeEvidencePath)) {
    return {};
  }
  try {
    return JSON.parse(fs6.readFileSync(runtimeEvidencePath, "utf-8"));
  } catch {
    return {};
  }
}
function parseTrailingJsonObject(raw) {
  const match = raw.match(/(\{[\s\S]*\})\s*$/);
  if (!match) {
    return {};
  }
  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
}
function readOpenClawChannelStatus() {
  const now2 = Date.now();
  if (openclawChannelStatusCache && openclawChannelStatusCache.expiresAt > now2) {
    return openclawChannelStatusCache.value;
  }
  try {
    const raw = execFileSync("openclaw", ["channels", "status", "--probe", "--json"], {
      encoding: "utf-8",
      timeout: 1e4,
      cwd: workspaceRoot2
    });
    const parsed = parseTrailingJsonObject(raw);
    openclawChannelStatusCache = { expiresAt: now2 + 15e3, value: parsed };
    return parsed;
  } catch {
    openclawChannelStatusCache = { expiresAt: now2 + 15e3, value: {} };
    return {};
  }
}
function resolveOpenClawNotifierModule(requirement) {
  const normalized = requirement.trim().toLowerCase();
  if (!normalized.includes("openclaw notifier")) {
    return null;
  }
  const status = readOpenClawChannelStatus();
  const channels = status.channels && typeof status.channels === "object" ? status.channels : {};
  const readyChannels = Object.entries(channels).filter(([, meta]) => Boolean(meta?.connected || meta?.running || meta?.configured)).map(([channelId, meta]) => {
    const state = meta?.connected ? "connected" : meta?.running ? "running" : meta?.configured ? "configured" : "offline";
    return `${channelId} (${state})`;
  });
  return {
    id: "module-integration-openclaw-notifier",
    label: requirement,
    summary: readyChannels.length > 0 ? `OpenClaw notifier is available via ${readyChannels.join(", ")}.` : "OpenClaw notifier is declared, but no active channel was detected at runtime.",
    installed: readyChannels.length > 0,
    sourceType: "integration",
    evidence: readyChannels.length > 0 ? "runtime" : "declared"
  };
}
function writeRuntimeSkillEvidence(data) {
  fs6.writeFileSync(runtimeEvidencePath, JSON.stringify(data, null, 2), "utf-8");
}
function recordRuntimeSkillEvidence(nodeId, modules) {
  if (!nodeId || modules.length === 0) {
    return;
  }
  const current = readRuntimeSkillEvidence();
  const existing = current[nodeId] ?? [];
  const merged = dedupeModules([
    ...existing.map((module) => ({ ...module, evidence: "runtime" })),
    ...modules.map((module) => ({ ...module, evidence: "runtime" }))
  ]);
  current[nodeId] = merged;
  writeRuntimeSkillEvidence(current);
}
function firstHeading3(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? null;
}
function firstParagraph3(markdown) {
  return markdown.replace(/^---[\s\S]*?---/, "").split("\n").map((line) => line.trim()).filter(Boolean).find((line) => !line.startsWith("#") && !line.startsWith("```")) ?? null;
}
function extractSection3(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `^##+\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##+\\s+|\\Z)`,
    "mi"
  );
  return markdown.match(regex)?.[1]?.trim() ?? "";
}
function extractBulletLines3(sectionContent) {
  return unique3(
    sectionContent.split("\n").map((line) => line.trim()).filter((line) => /^[-*]\s+/.test(line)).map((line) => line.replace(/^[-*]\s+/, "").trim()).filter(Boolean)
  );
}
function normalizeArrowList(raw) {
  if (!raw) {
    return [];
  }
  return unique3(
    raw.split(/\n|→|->|,|，|、|;/).map((item) => item.replace(/^[-*0-9.)\s]+/, "").trim()).filter(Boolean)
  );
}
function extractCommands3(markdown) {
  const commands = /* @__PURE__ */ new Set();
  const codeBlockRegex = /```(?:bash|sh)?\n([\s\S]*?)```/g;
  for (const match of markdown.matchAll(codeBlockRegex)) {
    match[1].split("\n").map((line) => line.trim()).filter(Boolean).forEach((line) => commands.add(line));
  }
  for (const match of markdown.matchAll(/`([^`]+)`/g)) {
    const candidate = match[1].trim();
    if (candidate.startsWith("/") || candidate.startsWith("claw ") || candidate.startsWith("python ") || candidate.startsWith("python3 ") || candidate.startsWith("npm ") || candidate.startsWith("uv ")) {
      commands.add(candidate);
    }
  }
  return [...commands].slice(0, 8);
}
function isRunnableCommand(command) {
  const normalized = command.trim();
  const isSlashWorkflow = /^\/[a-z0-9_-]+(?:\s|$)/i.test(normalized);
  return isSlashWorkflow || normalized.startsWith("python ") || normalized.startsWith("python3 ") || normalized.startsWith("npm ") || normalized.startsWith("node ") || normalized.startsWith("uv ") || normalized.startsWith("claw ");
}
function extractRunnableCommands(raw) {
  if (!raw) {
    return [];
  }
  const commands = /* @__PURE__ */ new Set();
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const normalized = trimmed.replace(/^(手动|自动|定时任务|执行|命令)[：:]\s*/u, "").replace(/\s*[（(]示例[）)]\s*$/u, "").trim();
    if (isRunnableCommand(normalized)) {
      commands.add(normalized);
    }
  }
  return [...commands];
}
function extractPlaceholderInputs(commands) {
  const seen = /* @__PURE__ */ new Set();
  const inputs = [];
  for (const command of commands) {
    for (const match of command.matchAll(/<([^>]+)>/g)) {
      const field = match[1].trim().replace(/\s*[（(]示例[）)]\s*$/u, "");
      if (!field || seen.has(field)) {
        continue;
      }
      seen.add(field);
      inputs.push({
        field,
        type: "text",
        required: true,
        placeholder: /时间范围/i.test(field) ? "\u4F8B\u5982\uFF1A\u660E\u5929\u4E0B\u5348 2 \u70B9\u5230 5 \u70B9" : /重点|focus/i.test(field) ? "\u4F8B\u5982\uFF1A\u5B89\u6392\u4F1A\u8BAE\u3001\u9605\u8BFB\u8BBA\u6587\u3001\u51C6\u5907\u6C47\u62A5" : /路径|path/i.test(field) ? "/absolute/path" : /token/i.test(field) ? "Enter token" : /id/i.test(field) ? "Enter id" : `Enter ${field}`
      });
    }
  }
  return inputs;
}
function inferAreaFromText(text) {
  const value = text.toLowerCase();
  if (value.includes("xhs") || value.includes("xiaohongshu") || value.includes("\u5C0F\u7EA2\u4E66") || value.includes("\u5185\u5BB9")) {
    return "\u5185\u5BB9\u751F\u4EA7\u4E0E\u5E73\u53F0\u8FD0\u8425";
  }
  if (value.includes("calendar") || value.includes("\u65E5\u7A0B") || value.includes("\u63D0\u9192") || value.includes("trip") || value.includes("\u51FA\u884C")) {
    return "\u65E5\u7A0B\u89C4\u5212\u4E0E\u63D0\u9192";
  }
  if (value.includes("journal") || value.includes("review") || value.includes("\u590D\u76D8") || value.includes("\u6210\u957F")) {
    return "\u65E5\u5FD7\u4E0E\u590D\u76D8";
  }
  if (value.includes("research") || value.includes("paper") || value.includes("\u6587\u732E") || value.includes("\u79D1\u7814")) {
    return "\u79D1\u7814\u4E0E\u7814\u7A76\u652F\u6301";
  }
  if (value.includes("file") || value.includes("archive") || value.includes("\u8D44\u6599") || value.includes("\u5F52\u6863")) {
    return "\u6587\u4EF6\u4E0E\u8D44\u6599\u7BA1\u7406";
  }
  if (value.includes("docker") || value.includes("devops") || value.includes("deploy") || value.includes("\u7F16\u7A0B")) {
    return "\u5DE5\u7A0B\u4E0E\u81EA\u52A8\u5316";
  }
  return "\u7EFC\u5408\u5DE5\u4F5C\u6D41";
}
function normalizeDomain(category, text) {
  const source = text.toLowerCase();
  if (category.startsWith("\u5185\u5BB9") || source.includes("\u5C0F\u7EA2\u4E66") || source.includes("xiaohongshu") || source.includes("xhs")) {
    return CONTENT_DOMAIN;
  }
  return category;
}
function inferContentArea(rawCategory, text) {
  const source = `${rawCategory} ${text}`.toLowerCase();
  if (source.includes("\u6293\u53D6") || source.includes("\u722C\u53D6") || source.includes("\u91C7\u96C6") || source.includes("extract") || source.includes("crawl") || source.includes("get-feed-detail") || source.includes("\u8BC4\u8BBA\u8BED\u4E49") || source.includes("comment semantic")) {
    return "\u5185\u5BB9\u91C7\u96C6";
  }
  if (source.includes("\u5206\u6790") || source.includes("\u6D1E\u5BDF") || source.includes("\u96F7\u8FBE") || source.includes("\u9009\u9898") || source.includes("\u70ED\u70B9") || source.includes("\u8D8B\u52BF") || source.includes("\u89C2\u70B9\u6C60") || source.includes("signal digest") || source.includes("\u6536\u85CF") || source.includes("\u7075\u611F") || source.includes("insight") || source.includes("research")) {
    return "\u5185\u5BB9\u6D1E\u5BDF";
  }
  if (source.includes("\u6539\u5199") || source.includes("repurpose") || source.includes("rewrite") || source.includes("\u591A\u5E73\u53F0") || source.includes("\u8F6C\u5316")) {
    return "\u5185\u5BB9\u6539\u5199";
  }
  if (source.includes("\u811A\u672C") || source.includes("\u5206\u955C") || source.includes("storyboard") || source.includes("director") || source.includes("\u5BFC\u6F14") || source.includes("brief") || source.includes("\u751F\u4EA7") || source.includes("\u89C6\u9891\u65B9\u6848") || source.includes("\u5185\u5BB9\u751F\u6210") || rawCategory === "\u5185\u5BB9\u751F\u6210") {
    return "\u5185\u5BB9\u751F\u4EA7";
  }
  if (source.includes("\u53D1\u5E03") || source.includes("\u590D\u76D8") || source.includes("pipeline") || source.includes("\u6D41\u6C34\u7EBF") || source.includes("\u6392\u671F")) {
    return "\u53D1\u5E03\u4E0E\u590D\u76D8";
  }
  return "\u5185\u5BB9\u751F\u4EA7";
}
function inferSopDomainAndArea(text) {
  const value = text.toLowerCase();
  if (value.includes("xhs") || value.includes("xiaohongshu") || value.includes("\u5C0F\u7EA2\u4E66") || value.includes("douyin") || value.includes("\u6296\u97F3") || value.includes("tiktok") || value.includes("twitter") || value.includes(" x ") || value.includes("x ") || value.includes("\u535A\u5BA2") || value.includes("blog") || value.includes("\u89C6\u9891") || value.includes("short video")) {
    return {
      domain: CONTENT_DOMAIN,
      area: inferContentArea("\u5185\u5BB9\u7CFB\u7EDF", text)
    };
  }
  if (value.includes("calendar") || value.includes("reminder") || value.includes("trip") || value.includes("\u65E5\u7A0B") || value.includes("\u63D0\u9192")) {
    return {
      domain: "\u4E2A\u4EBA\u7BA1\u7406",
      area: "\u65E5\u7A0B\u89C4\u5212\u4E0E\u63D0\u9192"
    };
  }
  if (value.includes("email") || value.includes("mail") || value.includes("\u90AE\u7BB1") || value.includes("\u90AE\u4EF6") || value.includes("inbox") || value.includes("reply")) {
    return {
      domain: "\u4E2A\u4EBA\u7BA1\u7406",
      area: "\u6C9F\u901A\u4E0E\u90AE\u4EF6"
    };
  }
  if (value.includes("research") || value.includes("paper") || value.includes("\u6587\u732E") || value.includes("\u79D1\u7814")) {
    return {
      domain: "\u79D1\u7814\u4E0E\u7814\u7A76",
      area: "\u7814\u7A76\u5DE5\u4F5C\u6D41"
    };
  }
  if (value.includes("file") || value.includes("archive") || value.includes("\u8D44\u6599") || value.includes("\u5F52\u6863")) {
    return {
      domain: "\u9879\u76EE\u4EA7\u51FA\u4E0E\u8D44\u6599\u7BA1\u7406",
      area: "\u6587\u4EF6\u4E0E\u8D44\u6599\u7BA1\u7406"
    };
  }
  if (value.includes("\u7F51\u9875") || value.includes("\u7F51\u7AD9") || value.includes("webpage") || value.includes("website") || value.includes("landing page") || value.includes("landing") || value.includes("frontend")) {
    return {
      domain: "\u9879\u76EE\u4EA7\u51FA\u4E0E\u8D44\u6599\u7BA1\u7406",
      area: "\u7F16\u7A0B"
    };
  }
  return {
    domain: "OpenClaw Workflow",
    area: inferAreaFromText(text)
  };
}
function readContentSystemNodes2() {
  if (!exists3(contentSkillTreePath2)) {
    return [];
  }
  const raw = JSON.parse(fs6.readFileSync(contentSkillTreePath2, "utf-8"));
  return raw.nodes ?? [];
}
function readSopFiles2() {
  if (!exists3(sopsRoot2)) {
    return [];
  }
  return fs6.readdirSync(sopsRoot2, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md")).map((entry) => path6.join(sopsRoot2, entry.name));
}
function buildInstalledSkillCatalog() {
  const skills = /* @__PURE__ */ new Map();
  for (const skill of listIndexedSkills()) {
    skills.set(skill.dirName, {
      id: `module-skill-${slugify(skill.dirName)}`,
      label: skill.label,
      summary: skill.summary,
      installed: true,
      installCommand: `claw skill install ${skill.dirName}`,
      installUrl: skill.installUrl,
      sourcePath: skill.skillPath,
      sourceType: "skill",
      capabilities: skill.features,
      dirName: skill.dirName,
      matchTokens: skill.matchTokens
    });
  }
  return skills;
}
function buildFoundationModuleCatalog(contentNodes) {
  const catalog = /* @__PURE__ */ new Map();
  for (const node of contentNodes.filter((item) => item.nodeType === "foundation")) {
    catalog.set(node.id, {
      id: `module-foundation-${slugify(node.id)}`,
      label: node.title,
      summary: firstParagraph3(node.functions ?? "") || "OpenClaw foundation module.",
      installed: true,
      sourceType: "foundation",
      sourcePath: contentSkillTreePath2,
      installCommand: node.invoke,
      capabilities: normalizeArrowList(node.functions)
    });
  }
  return catalog;
}
function cloneModule(module) {
  return {
    ...module,
    capabilities: module.capabilities ? [...module.capabilities] : void 0
  };
}
function dedupeModules(modules) {
  const map = /* @__PURE__ */ new Map();
  for (const module of modules) {
    if (!map.has(module.id)) {
      map.set(module.id, cloneModule(module));
    }
  }
  return [...map.values()].sort((a, b) => Number(a.installed) - Number(b.installed) || a.label.localeCompare(b.label));
}
function resolveDeclaredDependencyModules(dependencyIds, installedSkills, foundationModules) {
  const modules = [];
  for (const dependencyId of dependencyIds ?? []) {
    if (foundationModules.has(dependencyId)) {
      modules.push({
        ...cloneModule(foundationModules.get(dependencyId)),
        evidence: "declared"
      });
      continue;
    }
    const matchedSkill = [...installedSkills.values()].find(
      (skill) => skill.dirName === dependencyId || skill.label === dependencyId || skill.matchTokens.some((token) => dependencyId.toLowerCase().includes(token))
    );
    if (matchedSkill) {
      modules.push({
        ...cloneModule(matchedSkill),
        evidence: "declared"
      });
      continue;
    }
    modules.push({
      id: `module-integration-${slugify(dependencyId)}`,
      label: dependencyId,
      summary: "Referenced by this workflow as an external dependency.",
      installed: false,
      sourceType: "integration",
      evidence: "declared"
    });
  }
  return dedupeModules(modules);
}
function resolveExplicitTextSkillRefs(text, installedSkills) {
  const lowerText = text.toLowerCase();
  const modules = [];
  for (const skill of installedSkills.values()) {
    if (lowerText.includes(skill.dirName.toLowerCase()) || lowerText.includes(skill.label.toLowerCase()) || skill.matchTokens.some((token) => lowerText.includes(token))) {
      modules.push({
        ...cloneModule(skill),
        evidence: "explicit-text"
      });
    }
  }
  return dedupeModules(modules);
}
function resolveNamedRequirementModules(requirements, installedSkills) {
  const modules = [];
  for (const requirement of requirements) {
    const normalized = requirement.trim().toLowerCase();
    if (!normalized) {
      continue;
    }
    const notifierModule = resolveOpenClawNotifierModule(requirement);
    if (notifierModule) {
      modules.push(notifierModule);
      continue;
    }
    const matched = [...installedSkills.values()].find((skill) => {
      if (skill.dirName.toLowerCase() === normalized) {
        return true;
      }
      if (skill.label.toLowerCase() === normalized) {
        return true;
      }
      return skill.matchTokens.some((token) => normalized.includes(token));
    });
    if (matched) {
      modules.push({
        ...cloneModule(matched),
        evidence: "explicit-text"
      });
      continue;
    }
    modules.push({
      id: `module-integration-${slugify(requirement)}`,
      label: requirement,
      summary: "Referenced by this SOP as a required external capability or installable skill.",
      installed: false,
      sourceType: "integration",
      evidence: "explicit-text"
    });
  }
  return dedupeModules(modules);
}
function mergeWithRuntimeEvidence(nodeId, modules) {
  const runtimeEvidence = readRuntimeSkillEvidence()[nodeId] ?? [];
  return dedupeModules([
    ...modules,
    ...runtimeEvidence.map((module) => ({
      ...module,
      evidence: "runtime"
    }))
  ]);
}
function getWorkflowOverride(item) {
  if (item.id === "project_file_organize") {
    return {
      invoke: `python3 ${path6.join(appRoot, "scripts", "run_project_file_organize.py")} --target-dir <\u76EE\u6807\u76EE\u5F55> --rule <\u5F52\u6863\u89C4\u5219\u8BF4\u660E>`,
      inputs: [
        {
          field: "\u76EE\u6807\u76EE\u5F55",
          type: "text",
          required: true,
          placeholder: "/absolute/path/to/folder"
        },
        {
          field: "\u5F52\u6863\u89C4\u5219\u8BF4\u660E",
          type: "text",
          required: false,
          placeholder: "\u4F8B\u5982\uFF1A\u6309\u9879\u76EE/\u5E74\u4EFD\u5F52\u6863\uFF0C\u4FDD\u7559\u539F\u6587\u4EF6\u540D"
        }
      ]
    };
  }
  if (item.id == "project_file_index") {
    return {
      invoke: `python3 ${path6.join(appRoot, "scripts", "run_project_file_index.py")} --target-dir <\u76EE\u6807\u76EE\u5F55>`,
      inputs: [
        {
          field: "\u76EE\u6807\u76EE\u5F55",
          type: "text",
          required: true,
          placeholder: "/absolute/path/to/folder"
        }
      ]
    };
  }
  if (item.id == "content_writer") {
    return {
      invoke: `/content run --style xiaogai --count 1`,
      inputs: [
        {
          field: "\u6267\u884C\u53C2\u6570",
          type: "text",
          required: false,
          placeholder: "\u4F8B\u5982\uFF1A\u4E3B\u9898=\u7126\u8651\uFF1B\u5E73\u53F0=\u5C0F\u7EA2\u4E66"
        }
      ]
    };
  }
  return null;
}
function buildContentLeaves(installedSkills, foundationModules) {
  const items = readContentSystemNodes2();
  const leaves = [];
  for (const item of items.filter((entry) => entry.nodeType !== "foundation")) {
    const rawCategory = item.category?.trim() || "OpenClaw";
    const domain = normalizeDomain(
      rawCategory,
      `${item.title} ${item.functions ?? ""} ${item.applications ?? ""}`
    );
    const area = domain === CONTENT_DOMAIN ? inferContentArea(
      rawCategory,
      `${item.title} ${item.functions ?? ""} ${item.applications ?? ""}`
    ) : item.subcategory?.trim() || inferAreaFromText(`${item.title} ${item.functions ?? ""}`);
    const invokeLines = extractRunnableCommands(item.invoke);
    const workflowOverride = getWorkflowOverride(item);
    const effectiveCommands = workflowOverride ? [workflowOverride.invoke] : invokeLines;
    const leafText = [
      item.title,
      item.prerequisites,
      item.functions,
      item.applications,
      item.invoke,
      ...item.dependencies ?? []
    ].filter(Boolean).join(" ");
    leaves.push({
      id: `sop-content-${slugify(item.id || item.title)}`,
      label: item.title,
      domain,
      area,
      sourceType: "content-system",
      sourcePath: contentSkillTreePath2,
      summary: item.applications?.trim() || "Imported from structured content skill tree.",
      prerequisites: item.prerequisites,
      invoke: effectiveCommands[0],
      commands: effectiveCommands,
      capabilities: normalizeArrowList(item.functions),
      useCases: normalizeArrowList(item.applications).map((entry) => ({
        title: entry,
        summary: `${item.title} \u9762\u5411 ${entry}`
      })),
      inputs: workflowOverride?.inputs ?? (extractPlaceholderInputs(effectiveCommands).length > 0 ? extractPlaceholderInputs(effectiveCommands) : [{ field: "\u6267\u884C\u53C2\u6570", type: "text" }]),
      knowledgeDocs: (item.portfolio ?? []).map((doc) => ({
        title: doc.title || "Portfolio",
        url: toDocUrl2(path6.dirname(contentSkillTreePath2), doc.path)
      })),
      tags: unique3([
        domain,
        area,
        item.level ?? "",
        item.nodeType ?? ""
      ].filter(Boolean)),
      requiredSkills: mergeWithRuntimeEvidence(
        `sop-content-${slugify(item.id || item.title)}`,
        resolveDeclaredDependencyModules(
          item.dependencies,
          installedSkills,
          foundationModules
        )
      ),
      sourcePaths: [contentSkillTreePath2],
      mergedFrom: [item.title],
      route: resolveAgentRoute({
        domain,
        area,
        label: item.title,
        sourceType: "content-system",
        summary: item.applications?.trim() || item.functions?.trim() || "",
        commands: effectiveCommands
      })
    });
  }
  return leaves;
}
function buildSopLeaves(installedSkills, foundationModules) {
  const leaves = [];
  for (const sopPath of readSopFiles2()) {
    const markdown = readTextIfExists3(sopPath);
    if (!markdown) {
      continue;
    }
    const label = firstHeading3(markdown)?.replace(/^SOP:\s*/i, "") || path6.basename(sopPath, ".md");
    const summary = firstParagraph3(markdown) || "Imported from OpenClaw SOP.";
    const info = inferSopDomainAndArea(`${label} ${summary} ${markdown}`);
    const preconditions = extractBulletLines3(extractSection3(markdown, "Preconditions"));
    const requiredSkillNames = extractBulletLines3(extractSection3(markdown, "Required Skills"));
    const steps = extractSection3(markdown, "Steps").split("\n").map((line) => line.trim()).filter((line) => /^\d+\)/.test(line)).map((line) => line.replace(/^\d+\)\s*/, "").trim());
    const triggers = extractBulletLines3(extractSection3(markdown, "Default Trigger"));
    const commands = extractCommands3(markdown).filter(isRunnableCommand);
    const fileName = path6.basename(sopPath, ".md");
    const override = fileName === "xhs_comment_semantic_extract" ? {
      invoke: `python3 ${path6.join(appRoot, "scripts", "run_xhs_comment_semantic_extract.py")} --note-url <Xiaohongshu note URL> --output <Output path (optional)> --batch-size <Batch size (optional)>`,
      commands: [
        `python3 ${path6.join(appRoot, "scripts", "run_xhs_comment_semantic_extract.py")} --note-url <Xiaohongshu note URL> --output <Output path (optional)> --batch-size <Batch size (optional)>`
      ],
      inputs: [
        {
          field: "Xiaohongshu note URL",
          type: "text",
          required: true,
          placeholder: "https://www.xiaohongshu.com/explore/<feed_id>?xsec_token=..."
        },
        {
          field: "Output path (optional)",
          type: "text",
          required: false,
          placeholder: "/Users/<you>/Desktop/xhs_note_<feed_id>_comments.xlsx"
        },
        {
          field: "Batch size (optional)",
          type: "text",
          required: false,
          placeholder: "20",
          defaultValue: "20"
        }
      ]
    } : fileName === "email_inbox_digest" ? {
      invoke: `python3 ${path6.join(appRoot, "scripts", "run_email_inbox_digest.py")} --email-address <\u90AE\u7BB1\u5730\u5740> --imap-host <IMAP \u4E3B\u673A> --imap-port <IMAP \u7AEF\u53E3> --username <\u7528\u6237\u540D> --app-password <\u5E94\u7528\u4E13\u7528\u5BC6\u7801\u6216\u6388\u6743\u4EE4\u724C> --mailbox-scope <\u90AE\u7BB1\u8303\u56F4> --time-window <\u65F6\u95F4\u7A97\u53E3> --unread-only <\u662F\u5426\u9700\u8981\u53EA\u770B\u672A\u8BFB>`,
      commands: [
        `python3 ${path6.join(appRoot, "scripts", "run_email_inbox_digest.py")} --email-address <\u90AE\u7BB1\u5730\u5740> --imap-host <IMAP \u4E3B\u673A> --imap-port <IMAP \u7AEF\u53E3> --username <\u7528\u6237\u540D> --app-password <\u5E94\u7528\u4E13\u7528\u5BC6\u7801\u6216\u6388\u6743\u4EE4\u724C> --mailbox-scope <\u90AE\u7BB1\u8303\u56F4> --time-window <\u65F6\u95F4\u7A97\u53E3> --unread-only <\u662F\u5426\u9700\u8981\u53EA\u770B\u672A\u8BFB>`
      ],
      inputs: [
        { field: "\u90AE\u7BB1\u5730\u5740", type: "text", required: true, placeholder: "you@example.com" },
        { field: "IMAP \u4E3B\u673A", type: "text", required: true, placeholder: "imap.qq.com / imap.gmail.com" },
        { field: "IMAP \u7AEF\u53E3", type: "text", required: true, placeholder: "993", defaultValue: "993" },
        { field: "\u7528\u6237\u540D", type: "text", required: true, placeholder: "\u901A\u5E38\u4E0E\u90AE\u7BB1\u5730\u5740\u76F8\u540C" },
        { field: "\u5E94\u7528\u4E13\u7528\u5BC6\u7801\u6216\u6388\u6743\u4EE4\u724C", type: "text", required: true, placeholder: "\u586B\u5199\u6388\u6743\u7801\uFF0C\u4E0D\u662F\u666E\u901A\u767B\u5F55\u5BC6\u7801" },
        { field: "\u90AE\u7BB1\u8303\u56F4", type: "text", required: false, placeholder: "INBOX", defaultValue: "INBOX" },
        { field: "\u65F6\u95F4\u7A97\u53E3", type: "text", required: false, placeholder: "\u4F8B\u5982\uFF1A7d / today" },
        { field: "\u662F\u5426\u9700\u8981\u53EA\u770B\u672A\u8BFB", type: "text", required: false, placeholder: "yes / no", defaultValue: "yes" }
      ]
    } : fileName === "email_daily_triage_push" ? {
      invoke: `python3 ${path6.join(appRoot, "scripts", "run_email_daily_triage.py")} --email-profile <\u90AE\u7BB1\u8D26\u6237\u6863\u6848> --notify-channel <\u901A\u77E5\u901A\u9053\uFF08\u53EF\u9009\u8986\u76D6\uFF09> --mailbox-scope <\u90AE\u7BB1\u8303\u56F4> --time-window <\u65F6\u95F4\u7A97\u53E3> --unread-only <\u662F\u5426\u9700\u8981\u53EA\u770B\u672A\u8BFB> --only-unprocessed <\u662F\u5426\u9700\u8981\u53EA\u770B\u672A\u5904\u7406> --max-messages <\u6700\u5927\u90AE\u4EF6\u6570> --push-mode <\u63A8\u9001\u6A21\u5F0F>`,
      commands: [
        `python3 ${path6.join(appRoot, "scripts", "run_email_daily_triage.py")} --email-profile <\u90AE\u7BB1\u8D26\u6237\u6863\u6848> --notify-channel <\u901A\u77E5\u901A\u9053\uFF08\u53EF\u9009\u8986\u76D6\uFF09> --mailbox-scope <\u90AE\u7BB1\u8303\u56F4> --time-window <\u65F6\u95F4\u7A97\u53E3> --unread-only <\u662F\u5426\u9700\u8981\u53EA\u770B\u672A\u8BFB> --only-unprocessed <\u662F\u5426\u9700\u8981\u53EA\u770B\u672A\u5904\u7406> --max-messages <\u6700\u5927\u90AE\u4EF6\u6570> --push-mode <\u63A8\u9001\u6A21\u5F0F>`
      ],
      inputs: [
        { field: "\u90AE\u7BB1\u8D26\u6237\u6863\u6848", type: "text", required: false, placeholder: "\u9ED8\u8BA4\u4F7F\u7528\u5DF2\u4FDD\u5B58\u7684\u9ED8\u8BA4\u90AE\u7BB1\u8D26\u6237\u6863\u6848" },
        { field: "\u901A\u77E5\u901A\u9053\uFF08\u53EF\u9009\u8986\u76D6\uFF09", type: "text", required: false, placeholder: "\u7559\u7A7A\u5219\u8BFB\u53D6 openclaw-watchdog/.env \u4E2D\u7684 NOTIFIER", defaultValue: "" },
        { field: "\u90AE\u7BB1\u8303\u56F4", type: "text", required: false, placeholder: "INBOX", defaultValue: "INBOX" },
        { field: "\u65F6\u95F4\u7A97\u53E3", type: "text", required: false, placeholder: "\u4F8B\u5982\uFF1A1d / 7d", defaultValue: "1d" },
        { field: "\u662F\u5426\u9700\u8981\u53EA\u770B\u672A\u8BFB", type: "text", required: false, placeholder: "yes / no", defaultValue: "yes" },
        { field: "\u662F\u5426\u9700\u8981\u53EA\u770B\u672A\u5904\u7406", type: "text", required: false, placeholder: "yes / no", defaultValue: "yes" },
        { field: "\u6700\u5927\u90AE\u4EF6\u6570", type: "text", required: false, placeholder: "15", defaultValue: "15" },
        { field: "\u63A8\u9001\u6A21\u5F0F", type: "text", required: false, placeholder: "summary", defaultValue: "summary" }
      ]
    } : null;
    const inputs = extractBulletLines3(extractSection3(markdown, "Inputs")).map(
      (entry) => ({
        field: entry,
        type: "text",
        required: /url|link|path|token|feed_id|xsec|output/i.test(entry),
        placeholder: /xiaohongshu note url/i.test(entry) ? "https://www.xiaohongshu.com/explore/<feed_id>?xsec_token=..." : /output path|desktop/i.test(entry) ? "/Users/<you>/Desktop/..." : /xsec|token/i.test(entry) ? "Enter token" : /feed_id/i.test(entry) ? "Enter feed id" : void 0
      })
    );
    leaves.push({
      id: `sop-${slugify(label)}`,
      label,
      domain: info.domain,
      area: info.area,
      sourceType: "sop",
      sourcePath: sopPath,
      summary,
      prerequisites: preconditions.join("\uFF1B"),
      invoke: override?.invoke ?? commands[0],
      commands: override?.commands ?? commands,
      capabilities: steps.length > 0 ? steps : ["Imported from SOP markdown"],
      useCases: triggers.length > 0 ? triggers.map((entry) => ({ title: entry, summary })) : [{ title: "\u6807\u51C6\u5DE5\u4F5C\u6D41", summary }],
      inputs: override?.inputs ? override.inputs : inputs.length > 0 ? inputs : extractPlaceholderInputs(override?.commands ?? commands).length > 0 ? extractPlaceholderInputs(override?.commands ?? commands) : [{ field: "Workflow Input", type: "text" }],
      knowledgeDocs: [{ title: path6.basename(sopPath), url: toDocUrl2(path6.dirname(sopPath), sopPath) }],
      tags: [info.domain, info.area, "sop"],
      requiredSkills: mergeWithRuntimeEvidence(
        `sop-${slugify(label)}`,
        dedupeModules([
          ...resolveExplicitTextSkillRefs(
            `${label} ${summary} ${markdown}`,
            installedSkills
          ),
          ...resolveNamedRequirementModules(requiredSkillNames, installedSkills)
        ])
      ),
      sourcePaths: [sopPath],
      mergedFrom: [label],
      route: resolveAgentRoute({
        domain: info.domain,
        area: info.area,
        label,
        sourceType: "sop",
        summary,
        commands: override?.commands ?? commands
      })
    });
  }
  return leaves;
}
function uniqueDocs(docs) {
  const seen = /* @__PURE__ */ new Set();
  return docs.filter((doc) => {
    const key = `${doc.title}::${doc.url}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
function uniqueUseCases(useCases) {
  const seen = /* @__PURE__ */ new Set();
  return useCases.filter((item) => {
    const key = `${item.title}::${item.summary}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
function uniqueInputs(inputs) {
  const seen = /* @__PURE__ */ new Set();
  return inputs.filter((item) => {
    if (seen.has(item.field)) {
      return false;
    }
    seen.add(item.field);
    return true;
  });
}
function contentCanonicalLabel(leaf) {
  const text = `${leaf.label} ${leaf.summary} ${leaf.tags.join(" ")} ${leaf.sourcePaths.join(" ")}`.toLowerCase();
  if ((text.includes("single") || text.includes("\u5355\u6761")) && (text.includes("analysis") || text.includes("\u5206\u6790")) && (text.includes("xiaohongshu") || text.includes("xhs") || text.includes("\u5C0F\u7EA2\u4E66") || text.includes("douyin") || text.includes("\u6296\u97F3"))) {
    return { label: "\u5355\u6761\u5185\u5BB9\u6D1E\u5BDF\u4E0E\u5165\u5E93", area: "\u5185\u5BB9\u6D1E\u5BDF" };
  }
  if (text.includes("saved_video_insight") || text.includes("\u6536\u85CF") && text.includes("\u6D1E\u5BDF")) {
    return { label: "\u6536\u85CF\u5185\u5BB9\u6D1E\u5BDF", area: "\u5185\u5BB9\u6D1E\u5BDF" };
  }
  if ((text.includes("topic_radar") || text.includes("\u70ED\u70B9\u96F7\u8FBE") || text.includes("\u9009\u9898\u96F7\u8FBE")) && (text.includes("xiaohongshu") || text.includes("xhs") || text.includes("\u5C0F\u7EA2\u4E66") || text.includes("douyin") || text.includes("\u6296\u97F3"))) {
    return { label: "\u5E73\u53F0\u70ED\u70B9\u9009\u9898\u96F7\u8FBE", area: "\u5185\u5BB9\u6D1E\u5BDF" };
  }
  if (text.includes("x signal") || text.includes("\u89C2\u70B9\u6C60")) {
    return { label: "\u8D8B\u52BF\u4FE1\u53F7\u4E0E\u89C2\u70B9\u6C60", area: "\u5185\u5BB9\u6D1E\u5BDF" };
  }
  if (text.includes("comment semantic") || text.includes("\u8BC4\u8BBA\u8BED\u4E49")) {
    return { label: "\u8BC4\u8BBA\u8BED\u4E49\u63D0\u53D6\u4E0E\u7ED3\u6784\u5316", area: "\u5185\u5BB9\u91C7\u96C6" };
  }
  if (text.includes("storyboard") || text.includes("\u5206\u955C") || text.includes("\u77ED\u89C6\u9891\u811A\u672C")) {
    return { label: "\u77ED\u89C6\u9891\u811A\u672C\u4E0E\u5206\u955C\u4EA4\u4ED8", area: "\u5185\u5BB9\u751F\u4EA7" };
  }
  if (text.includes("repurpose") || text.includes("\u591A\u5E73\u53F0\u6539\u5199") || text.includes("\u6539\u5199\u5305")) {
    return { label: "\u591A\u5E73\u53F0\u5185\u5BB9\u6539\u5199\u5305", area: "\u5185\u5BB9\u6539\u5199" };
  }
  if (text.includes("content_writer") || text.includes("\u5C0F\u76D6\u98CE\u683C\u5185\u5BB9\u751F\u6210")) {
    return { label: "\u957F\u6587\u5185\u5BB9\u751F\u6210", area: "\u5185\u5BB9\u751F\u4EA7" };
  }
  if (text.includes("content_pipeline") || text.includes("\u6D41\u6C34\u7EBF")) {
    return { label: "\u5185\u5BB9\u751F\u4EA7\u6D41\u6C34\u7EBF", area: "\u53D1\u5E03\u4E0E\u590D\u76D8" };
  }
  return {
    label: leaf.label.replace(/^(小红书|抖音|Xiaohongshu|Douyin)\s*/i, "").replace(/\b(XHS|Douyin|Xiaohongshu)\b/gi, "").trim(),
    area: leaf.area
  };
}
function mergeContentLeaves(leaves) {
  const merged = /* @__PURE__ */ new Map();
  for (const leaf of leaves) {
    if (leaf.domain !== CONTENT_DOMAIN) {
      const passthroughKey = `${leaf.domain}::${leaf.area}::${leaf.id}`;
      merged.set(passthroughKey, leaf);
      continue;
    }
    const canonical = contentCanonicalLabel(leaf);
    const key = `${leaf.domain}::${canonical.area}::${canonical.label}`;
    const existing = merged.get(key);
    const sourceDocEntries = leaf.sourcePaths.map((sourcePath) => ({
      title: `\u6765\u6E90\uFF1A${path6.basename(sourcePath)}`,
      url: toDocUrl2(path6.dirname(sourcePath), sourcePath)
    }));
    if (!existing) {
      merged.set(key, {
        ...leaf,
        label: canonical.label,
        area: canonical.area,
        knowledgeDocs: uniqueDocs([...sourceDocEntries, ...leaf.knowledgeDocs])
      });
      continue;
    }
    merged.set(key, {
      ...existing,
      summary: unique3([existing.summary, leaf.summary]).filter(Boolean).join(" / "),
      prerequisites: unique3([existing.prerequisites, leaf.prerequisites].filter(Boolean)).join("\uFF1B"),
      invoke: existing.invoke || leaf.invoke,
      commands: unique3([...existing.commands, ...leaf.commands]),
      capabilities: unique3([...existing.capabilities, ...leaf.capabilities]),
      useCases: uniqueUseCases([...existing.useCases, ...leaf.useCases]),
      inputs: uniqueInputs([...existing.inputs, ...leaf.inputs]),
      knowledgeDocs: uniqueDocs([...existing.knowledgeDocs, ...sourceDocEntries, ...leaf.knowledgeDocs]),
      tags: unique3([...existing.tags, ...leaf.tags, canonical.area, canonical.label]),
      requiredSkills: dedupeModules([...existing.requiredSkills, ...leaf.requiredSkills]),
      sourcePaths: unique3([...existing.sourcePaths, ...leaf.sourcePaths]),
      mergedFrom: unique3([...existing.mergedFrom, ...leaf.mergedFrom]),
      route: existing.route
    });
  }
  return [...merged.values()];
}
function buildParentNode(id, level, label, parentId, children) {
  const requiredSkills = dedupeModules(
    children.flatMap((child) => child.requiredSkills)
  );
  const sopCount = children.length;
  const route = resolveAgentRoute({
    domain: level === 1 ? label : children[0]?.domain ?? label,
    area: level === 2 ? label : children[0]?.area ?? label,
    label,
    summary: children.map((child) => child.summary).join(" "),
    commands: children.flatMap((child) => child.commands).slice(0, 12)
  });
  return {
    id,
    level,
    label,
    status: "idle",
    parentId,
    subtitle: level === 1 ? `${sopCount} SOP \xB7 ${requiredSkills.length} \u6280\u80FD\u6A21\u5757` : `${sopCount} workflows`,
    childCount: sopCount,
    drawerContent: {
      summary: level === 1 ? `\u8BE5\u529F\u80FD\u5927\u7C7B\u4E0B\u5305\u542B ${sopCount} \u4E2A SOP\uFF0C\u8FD0\u884C\u524D\u81F3\u5C11\u9700\u8981\u51C6\u5907\u4EE5\u4E0B\u6280\u80FD\u6A21\u5757\u3002` : `\u8BE5\u5177\u4F53\u9886\u57DF\u4E0B\u5305\u542B ${sopCount} \u4E2A SOP\uFF0C\u4EE5\u4E0B\u6280\u80FD\u6A21\u5757\u662F\u6700\u5C0F\u53EF\u8FD0\u884C\u96C6\u5408\u3002`,
      minimumSkillsNote: requiredSkills.length > 0 ? `\u6700\u5C11\u9700\u8981 ${requiredSkills.length} \u4E2A\u6280\u80FD\u6A21\u5757` : "\u8BE5\u5C42\u7EA7\u6682\u65E0\u663E\u5F0F\u6280\u80FD\u4F9D\u8D56",
      route,
      capabilities: level === 1 ? children.slice(0, 8).map((child) => child.label) : children.map((child) => child.label),
      useCases: children.slice(0, 8).map((child) => ({
        title: child.label,
        summary: child.summary
      })),
      inputs: [],
      requiredSkills,
      knowledgeBase: {
        tags: unique3(children.flatMap((child) => child.tags)).slice(0, 12),
        documents: []
      }
    }
  };
}
function getDomainOrder(label) {
  const order = ["\u4E2A\u4EBA\u7BA1\u7406", CONTENT_DOMAIN, "\u9879\u76EE\u4EA7\u51FA\u4E0E\u8D44\u6599\u7BA1\u7406"];
  const index = order.indexOf(label);
  return index === -1 ? order.length : index;
}
function getAreaOrder(domain, label) {
  if (domain === CONTENT_DOMAIN) {
    const index = CONTENT_AREAS.indexOf(label);
    return index === -1 ? CONTENT_AREAS.length : index;
  }
  return 999;
}
function loadSkillTreeNodes() {
  const installedSkills = buildInstalledSkillCatalog();
  const contentNodes = readContentSystemNodes2();
  const foundationModules = buildFoundationModuleCatalog(contentNodes);
  const leaves = mergeContentLeaves([
    ...buildContentLeaves(installedSkills, foundationModules),
    ...buildSopLeaves(installedSkills, foundationModules)
  ]);
  const groupedByDomain = /* @__PURE__ */ new Map();
  for (const leaf of leaves) {
    const bucket = groupedByDomain.get(leaf.domain) ?? [];
    bucket.push(leaf);
    groupedByDomain.set(leaf.domain, bucket);
  }
  const nodes = [];
  const sortedDomains = [...groupedByDomain.entries()].sort(
    (a, b) => getDomainOrder(a[0]) - getDomainOrder(b[0]) || a[0].localeCompare(b[0], "zh-Hans-CN")
  );
  for (const [domain, domainLeaves] of sortedDomains) {
    const domainId = `domain-${slugify(domain)}`;
    nodes.push(buildParentNode(domainId, 1, domain, null, domainLeaves));
    const groupedByArea = /* @__PURE__ */ new Map();
    for (const leaf of domainLeaves) {
      const bucket = groupedByArea.get(leaf.area) ?? [];
      bucket.push(leaf);
      groupedByArea.set(leaf.area, bucket);
    }
    if (domain === CONTENT_DOMAIN) {
      for (const area of CONTENT_AREAS) {
        if (!groupedByArea.has(area)) {
          groupedByArea.set(area, []);
        }
      }
    }
    const sortedAreas = [...groupedByArea.entries()].sort((a, b) => {
      const diff = getAreaOrder(domain, a[0]) - getAreaOrder(domain, b[0]);
      if (diff !== 0) {
        return diff;
      }
      return a[0].localeCompare(b[0], "zh-Hans-CN");
    });
    for (const [area, areaLeaves] of sortedAreas) {
      const areaId = `area-${slugify(domain)}-${slugify(area)}`;
      nodes.push(buildParentNode(areaId, 2, area, domainId, areaLeaves));
      for (const leaf of areaLeaves) {
        nodes.push({
          id: leaf.id,
          level: 3,
          label: leaf.label,
          subtitle: leaf.mergedFrom.length > 1 ? `Merged SOP \xB7 ${leaf.mergedFrom.length} sources` : leaf.sourceType === "sop" ? "SOP" : "Workflow",
          status: "idle",
          parentId: areaId,
          sourceType: leaf.sourceType,
          sourcePath: leaf.sourcePath,
          drawerContent: {
            summary: leaf.mergedFrom.length > 1 ? `${leaf.summary}\u3002\u5DF2\u878D\u5408 ${leaf.mergedFrom.length} \u4E2A\u540C\u7C7B SOP\uFF1A${leaf.mergedFrom.join("\u3001")}` : leaf.summary,
            prerequisites: leaf.prerequisites,
            minimumSkillsNote: leaf.requiredSkills.length > 0 ? `\u8FD0\u884C\u6B64 SOP \u6700\u5C11\u9700\u8981 ${leaf.requiredSkills.length} \u4E2A\u6280\u80FD\u6A21\u5757` : "\u8BE5 SOP \u6682\u65E0\u663E\u5F0F\u6280\u80FD\u4F9D\u8D56",
            route: leaf.route,
            capabilities: leaf.capabilities,
            useCases: leaf.useCases,
            inputs: leaf.inputs,
            invoke: leaf.invoke,
            commands: leaf.commands,
            requiredSkills: leaf.requiredSkills,
            knowledgeBase: {
              tags: leaf.tags,
              documents: leaf.knowledgeDocs
            }
          }
        });
      }
    }
  }
  return nodes.sort((a, b) => {
    if (a.level !== b.level) {
      return a.level - b.level;
    }
    if (a.level === 1) {
      return getDomainOrder(a.label) - getDomainOrder(b.label);
    }
    if ((a.parentId ?? "") !== (b.parentId ?? "")) {
      return (a.parentId ?? "").localeCompare(b.parentId ?? "", "zh-Hans-CN");
    }
    if (a.level === 2) {
      const parent = nodes.find((node) => node.id === a.parentId);
      const domainLabel = parent?.label ?? "";
      const diff = getAreaOrder(domainLabel, a.label) - getAreaOrder(domainLabel, b.label);
      if (diff !== 0) {
        return diff;
      }
    }
    return a.label.localeCompare(b.label, "zh-Hans-CN");
  });
}

// src/server/cloudConsoleAccess.ts
import crypto from "node:crypto";
var accessAudience = "solocore-console";
var sessionAudience = "solocore-console-session";
var sessionCookieName = "solocore_console_session";
function accessSecret() {
  return (process.env.SOLOCORE_CONSOLE_ACCESS_SECRET || process.env.OPENCLAW_CONSOLE_ACCESS_SECRET || "").trim();
}
function internalToken() {
  return (process.env.SOLOCORE_CLOUD_CONSOLE_INTERNAL_TOKEN || process.env.OPENCLAW_CLOUD_CONSOLE_INTERNAL_TOKEN || "").trim();
}
function secureCookiesEnabled() {
  if (process.env.SOLOCORE_CONSOLE_SECURE_COOKIE === "1") {
    return true;
  }
  if (process.env.SOLOCORE_CONSOLE_SECURE_COOKIE === "0") {
    return false;
  }
  const publicUrl = process.env.SOLOCORE_CLOUD_CONSOLE_PUBLIC_URL || process.env.OPENCLAW_CLOUD_CONSOLE_PUBLIC_URL || "";
  return publicUrl.startsWith("https://");
}
function parseCookies(cookieHeader) {
  if (!cookieHeader) {
    return /* @__PURE__ */ new Map();
  }
  return new Map(
    cookieHeader.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
      const index = part.indexOf("=");
      if (index === -1) {
        return [part, ""];
      }
      return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    })
  );
}
function signToken(payload) {
  const secret = accessSecret();
  if (!secret) {
    throw new Error("SOLOCORE_CONSOLE_ACCESS_SECRET is not configured");
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}
function verifyToken(token) {
  const secret = accessSecret();
  if (!secret || !token.includes(".")) {
    return null;
  }
  const [encodedPayload, signature] = token.split(".", 2);
  const expected = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  if (signature.length !== expected.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}
function cloudConsoleAccessEnabled() {
  return Boolean(accessSecret());
}
function requestHasInternalConsoleAccess(req) {
  const token = internalToken();
  if (!token) {
    return false;
  }
  return req.header("x-solocore-internal-token") === token;
}
function readConsoleSession(req) {
  const token = parseCookies(req.headers.cookie).get(sessionCookieName) || "";
  const payload = verifyToken(token);
  if (!payload || payload.aud !== sessionAudience || payload.exp * 1e3 <= Date.now()) {
    return null;
  }
  return payload;
}
function acceptConsoleGrant(grantToken) {
  const payload = verifyToken(grantToken);
  if (!payload || payload.aud !== accessAudience || payload.exp * 1e3 <= Date.now()) {
    return null;
  }
  return payload;
}
function setConsoleSessionCookie(res, payload) {
  const sessionExp = payload.sessionExp && payload.sessionExp > payload.iat ? payload.sessionExp : payload.exp;
  const token = signToken({
    ...payload,
    aud: sessionAudience,
    exp: sessionExp
  });
  res.cookie(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookiesEnabled(),
    expires: new Date(sessionExp * 1e3)
  });
}
function clearConsoleSessionCookie(res) {
  res.clearCookie(sessionCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookiesEnabled()
  });
}

// server.ts
var HEARTBEAT_INTERVAL_MS = 5e3;
var AGENT_OFFLINE_TIMEOUT_MS = 15e3;
var TASK_CLAIM_TIMEOUT_MS = 3e4;
var MAX_RECENT_TASKS = 8;
var DEFAULT_HISTORY_GROUP_LIMIT = 6;
var APP_DEV_SESSION_ID = "forge-console-dev";
var homeDir3 = os3.homedir();
var workspaceRoot3 = getRepoRoot();
var runtimeRoot2 = getRuntimeRoot();
var localPackageRegistryScript = path7.join(process.cwd(), "scripts", "local_package_registry.py");
var localPackageStagingRoot = path7.join(runtimeRoot2, "staged", "community-package-staging");
var taskHistoryPath = path7.join(runtimeRoot2, "agent", "task-history.json");
var inputProfilesPath = path7.join(runtimeRoot2, "agent", "input-profiles.json");
var decisionStatePath = path7.join(runtimeRoot2, "agent", "decision-state.json");
var libraryRoot2 = path7.resolve(readAgentOsConfig().assetRootPath);
var docRoots = [
  path7.join(homeDir3, ".openclaw"),
  libraryRoot2,
  ...getSkillSourceRoots(),
  process.cwd()
];
var cloudOfficialPackageRoot = process.env.SOLOCORE_CLOUD_PACKAGE_ROOT || process.env.OPENCLAW_CLOUD_PACKAGE_ROOT || "/var/lib/openclaw-web-platform/data/storage";
var fileActionRoots = [
  ...docRoots,
  path7.join(homeDir3, "Desktop"),
  path7.join(homeDir3, "Downloads"),
  cloudOfficialPackageRoot
];
var knowledgeCasesRoot = path7.join(runtimeRoot2, "knowledge", "cases");
var runtimeLessonsRoot = path7.join(runtimeRoot2, "knowledge", "runtime-lessons");
var legacyAssetRoots = [path7.join(workspaceRoot3, "content_system")];
var DEFAULT_SHORT_VIDEO_SERIES = "AI\u5185\u5BB9\u7CFB\u7EDF";
var DEFAULT_SHORT_VIDEO_INSTANCE_SUFFIX = "\u77ED\u89C6\u9891\u5BF9\u6807\u8BD5\u70B9";
var DEFAULT_SHORT_VIDEO_MIN_SAMPLE_SIZE = 3;
var DEFAULT_SHORT_VIDEO_SAMPLE_SIZE = 5;
var NOTEBOOKLM_ACCOUNT_MAP = path7.join(path7.resolve(readAgentOsConfig().assetRootPath), "mappings", "notebooklm-account-map.json");
var DEFAULT_STORAGE_SERIES = "AI\u5185\u5BB9\u7CFB\u7EDF";
var DEFAULT_STORAGE_INSTANCE_SUFFIX = "\u5B58\u50A8\u4E0E\u68C0\u7D22";
var STORAGE_PROJECT_MEMORY_FILE = "project-memory.json";
var geminiConsentPath = path7.join(
  homeDir3,
  "Library",
  "Application Support",
  "baoyu-skills",
  "gemini-web",
  "consent.json"
);
var notebookLmStatePath = path7.join(
  homeDir3,
  ".agents",
  "skills",
  "notebooklm",
  "data",
  "browser_state",
  "state.json"
);
var notebookLmValidationPath = path7.join(
  homeDir3,
  ".agents",
  "skills",
  "notebooklm",
  "data",
  "validation.json"
);
var shortVideoNodeLabels = {
  short_video_account_research: "\u8FD0\u884C\u8D26\u53F7\u7814\u7A76",
  short_video_creative_brief: "\u751F\u6210 Creative Brief",
  short_video_director_production: "\u542F\u52A8\u5BFC\u6F14\u4E0E\u751F\u4EA7\u94FE",
  short_video_insight_capture: "\u6536\u85CF\u89C6\u9891\u6D1E\u5BDF",
  notebooklm_account_enhance: "NotebookLM \u589E\u5F3A\u5F52\u7EB3"
};
var runtimeKnowledgeDb = [...seedKnowledgeBase];
var commandQueue = [];
var agentState = {
  id: null,
  online: false,
  lastSeenAt: null
};
var appDevSessionBootstrapped = false;
var residentAgentProcess = null;
var residentAgentRestartTimer = null;
var residentAgentStartGracePassed = false;
var RESIDENT_AGENT_START_GRACE_MS = 8e3;
var RESIDENT_AGENT_RESTART_DELAY_MS = 4e3;
function residentAgentAutostartEnabled() {
  if (process.env.OPENCLAW_DISABLE_AGENT_AUTOSTART === "1") {
    return false;
  }
  if (process.env.OPENCLAW_ENABLE_AGENT_AUTOSTART === "1") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
}
function now() {
  return Date.now();
}
function clearResidentAgentRestartTimer() {
  if (residentAgentRestartTimer) {
    clearTimeout(residentAgentRestartTimer);
    residentAgentRestartTimer = null;
  }
}
function spawnResidentAgent() {
  if (residentAgentProcess && !residentAgentProcess.killed) {
    return;
  }
  clearResidentAgentRestartTimer();
  const child = spawn("python3", ["openclaw_agent.py"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      OPENCLAW_BASE_URL: process.env.OPENCLAW_BASE_URL || "http://127.0.0.1:3000",
      OPENCLAW_AGENT_ID: process.env.OPENCLAW_AGENT_ID || "openclaw-resident-agent"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  residentAgentProcess = child;
  child.stdout?.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) {
      console.log(`[resident-agent] ${text}`);
    }
  });
  child.stderr?.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) {
      console.error(`[resident-agent] ${text}`);
    }
  });
  child.on("exit", (code, signalName) => {
    residentAgentProcess = null;
    console.warn(`[resident-agent] exited (code=${code ?? "null"}, signal=${signalName ?? "null"})`);
    if (residentAgentStartGracePassed) {
      residentAgentRestartTimer = setTimeout(() => {
        if (!agentState.online) {
          spawnResidentAgent();
        }
      }, RESIDENT_AGENT_RESTART_DELAY_MS);
    }
  });
}
function ensureResidentAgent() {
  if (!residentAgentAutostartEnabled()) {
    return;
  }
  if (agentState.online) {
    return;
  }
  if (residentAgentProcess && !residentAgentProcess.killed) {
    return;
  }
  spawnResidentAgent();
}
function inferExecutionMode(nodeId, command) {
  const normalized = command.trim();
  if (normalized.startsWith("__OPENCLAW_EVOLUTION__")) {
    return "evolution";
  }
  if (nodeId === "project_file_organize") {
    return "asset-organize";
  }
  if (nodeId === "project_file_index") {
    return "asset-index";
  }
  if (nodeId === "short_video_account_research") {
    return "short-video-account-research";
  }
  if (nodeId === "short_video_creative_brief") {
    return "short-video-creative-brief";
  }
  if (nodeId === "short_video_director_production") {
    return "short-video-director-production";
  }
  if (nodeId === "short_video_insight_capture") {
    return "short-video-insight-capture";
  }
  if (nodeId === "notebooklm_account_enhance") {
    return "notebooklm-account-enhance";
  }
  if (normalized.startsWith("__OPENCLAW_WORKFLOW__")) {
    return "workflow";
  }
  if (normalized.startsWith("/")) {
    return "slash";
  }
  if (normalized.startsWith("python ") || normalized.startsWith("python3 ") || normalized.startsWith("npm ") || normalized.startsWith("node ") || normalized.startsWith("uv ") || normalized.startsWith("claw ")) {
    return "shell";
  }
  return "unknown";
}
function stageForStatus(status) {
  if (status === "queued") {
    return "queued";
  }
  if (status === "claimed") {
    return "claimed";
  }
  if (status === "running") {
    return "executing";
  }
  if (status === "completed") {
    return "completed";
  }
  return "failed";
}
function isPathInsideLegacyRoots(targetPath) {
  const resolved = path7.resolve(targetPath);
  return legacyAssetRoots.some((root) => {
    const absoluteRoot = path7.resolve(root);
    return resolved === absoluteRoot || resolved.startsWith(`${absoluteRoot}${path7.sep}`);
  });
}
function buildAssetRootState() {
  const config = readAgentOsConfig();
  const configPath2 = getAssetRootConfigPath();
  const configured = fs7.existsSync(configPath2);
  const naming = getNamingContract();
  return {
    path: path7.resolve(config.assetRootPath),
    configured,
    source: configured ? "saved" : "default",
    configPath: configPath2,
    suggestedPath: getSuggestedAssetRootPath(),
    legacyWorkspaceRoots: legacyAssetRoots,
    namingContract: {
      version: "v1",
      summary: [
        "New long-term assets use a type prefix + date/version + status suffix.",
        "Human-readable and AI-readable companions share the same base name and differ only by the role suffix.",
        "Draft and final artifacts keep separate suffixes so the latest stable result remains easy to locate."
      ],
      rules: [
        {
          id: "type-prefix",
          label: "Type Prefix",
          pattern: Object.entries(naming.typePrefixes).map(([kind, prefix]) => `${kind}:${prefix}`).join(", "),
          example: "DOC__20260319__mission-control-brief__draft__human.md"
        },
        {
          id: "human-ai-pair",
          label: "Human/AI Pairing",
          pattern: `<base>${naming.humanAiPairGuidance.separator}<human|ai>`,
          example: `topic${naming.humanAiPairGuidance.separator}${naming.humanAiPairGuidance.humanSuffix}.md / topic${naming.humanAiPairGuidance.separator}${naming.humanAiPairGuidance.aiSuffix}.md`
        },
        {
          id: "status",
          label: "Status Suffix",
          pattern: Object.values(naming.statusLabels).join(" | "),
          example: "DATA__20260319__comment-batch__review__ai.json"
        },
        {
          id: "version",
          label: "Version",
          pattern: naming.versionPattern,
          example: "PLN__20260319__agent-os-rollout__v1.0__final__human.md"
        }
      ]
    }
  };
}
function normalizeDecisionPriority(priority) {
  if (priority === "urgent") {
    return "p0";
  }
  if (priority === "high") {
    return "p1";
  }
  if (priority === "medium") {
    return "p2";
  }
  return "p3";
}
function shortVideoDefaultInstance() {
  const stamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
  return `${stamp}__${DEFAULT_SHORT_VIDEO_INSTANCE_SUFFIX}`;
}
function storageDefaultInstance() {
  const stamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
  return `${stamp}__${DEFAULT_STORAGE_INSTANCE_SUFFIX}`;
}
function sanitizeSegment(value, fallback = "untitled") {
  const normalized = value.trim().replace(/\s+/g, "_").replace(/[^0-9A-Za-z\u4e00-\u9fff._-]+/g, "").replace(/^[_\-.]+|[_\-.]+$/g, "");
  return normalized.slice(0, 80) || fallback;
}
function detectShortVideoPlatform(url) {
  const lower = url.toLowerCase();
  if (lower.includes("douyin.com") || lower.includes("iesdouyin.com")) {
    return "douyin";
  }
  if (lower.includes("xhslink.com") || lower.includes("xiaohongshu.com")) {
    return "xiaohongshu";
  }
  return "unknown";
}
function storageSeriesPaths() {
  const root = path7.resolve(readAgentOsConfig().assetRootPath);
  const instance = storageDefaultInstance();
  return {
    assetBase: path7.join(root, "assets", DEFAULT_STORAGE_SERIES, instance),
    knowledgeBase: path7.join(root, "knowledge", "projects", DEFAULT_STORAGE_SERIES, instance)
  };
}
function storageImportRoot() {
  return path7.join(storageSeriesPaths().assetBase, "intake", "storage-retrieval");
}
function storageProjectMemoryPath() {
  return path7.join(storageSeriesPaths().assetBase, "mappings", STORAGE_PROJECT_MEMORY_FILE);
}
function classifyStorageFileType(targetPath, isDirectory = false) {
  if (isDirectory) {
    return "directory";
  }
  const ext = path7.extname(targetPath).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".heic", ".svg"].includes(ext)) {
    return "image";
  }
  if ([".mp4", ".mov", ".m4v", ".webm", ".avi"].includes(ext)) {
    return "video";
  }
  if ([".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"].includes(ext)) {
    return "document";
  }
  if ([".md", ".txt"].includes(ext)) {
    return "knowledge";
  }
  if ([".json", ".csv", ".yaml", ".yml"].includes(ext)) {
    return "data";
  }
  return "document";
}
function decodeImportTextSample(fileName, contentBase64) {
  if (!contentBase64) {
    return "";
  }
  const fileType = classifyStorageFileType(fileName, false);
  if (!["knowledge", "data", "document"].includes(fileType)) {
    return "";
  }
  try {
    return Buffer.from(contentBase64, "base64").toString("utf-8").slice(0, 6e3);
  } catch {
    return "";
  }
}
function buildStorageMemoryTokens(source, textSample = "") {
  const sourceBase = path7.basename(source).toLowerCase();
  const rawTokens = [
    sourceBase,
    ...sourceBase.split(/[_\-\s.]+/g),
    ...textSample.toLowerCase().match(/[a-z0-9\u4e00-\u9fff]{4,}/g) ?? []
  ];
  return [...new Set(rawTokens.map((item) => item.trim()).filter((item) => item.length >= 4))].slice(0, 24);
}
function loadStorageProjectMemory() {
  const memoryPath = storageProjectMemoryPath();
  if (!fs7.existsSync(memoryPath)) {
    return { rules: [] };
  }
  try {
    return JSON.parse(fs7.readFileSync(memoryPath, "utf-8"));
  } catch {
    return { rules: [] };
  }
}
function saveStorageProjectMemory(memory) {
  const targetPath = storageProjectMemoryPath();
  ensureDir(path7.dirname(targetPath));
  fs7.writeFileSync(targetPath, JSON.stringify(memory, null, 2), "utf-8");
}
function matchStorageProjectMemory(source, textSample = "") {
  const memory = loadStorageProjectMemory();
  const tokens = buildStorageMemoryTokens(source, textSample);
  return memory.rules.find((rule) => tokens.includes(rule.token)) ?? null;
}
function rememberStorageClassification(input) {
  const memory = loadStorageProjectMemory();
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  for (const token of buildStorageMemoryTokens(input.source, input.textSample ?? "").slice(0, 8)) {
    const existing = memory.rules.find((rule) => rule.token === token);
    if (existing) {
      existing.projectFolder = input.projectFolder;
      existing.workflow = input.workflow;
      existing.stage = input.stage;
      existing.sourceKind = input.sourceKind;
      existing.createdAt = createdAt;
    } else {
      memory.rules.push({
        token,
        projectFolder: input.projectFolder,
        workflow: input.workflow,
        stage: input.stage,
        sourceKind: input.sourceKind,
        createdAt
      });
    }
  }
  saveStorageProjectMemory(memory);
}
function inferStorageProjectFolder(source, textSample = "") {
  const corpus = `${source}
${textSample}`.toLowerCase();
  if (corpus.includes("agent system") || corpus.includes("agent\u64CD\u4F5C\u7CFB\u7EDF") || corpus.includes("architecture draft") || corpus.includes("system architecture") || corpus.includes("openclaw") || corpus.includes("mission-control")) {
    return "Agent\u64CD\u4F5C\u7CFB\u7EDF";
  }
  if (corpus.includes("xiaohongshu") || corpus.includes("xhs_") || corpus.includes("comment") || corpus.includes("comments.xlsx") || corpus.includes("\u5C0F\u7EA2\u4E66")) {
    return "\u5C0F\u7EA2\u4E66\u5185\u5BB9\u7814\u7A76";
  }
  if (corpus.includes("douyin") || corpus.includes("\u6296\u97F3") || corpus.includes("short video") || corpus.includes("\u77ED\u89C6\u9891")) {
    return "\u77ED\u89C6\u9891\u5185\u5BB9\u7CFB\u7EDF";
  }
  if (corpus.includes("notebooklm") || corpus.includes("gemini") || corpus.includes("ai ")) {
    return "AI\u5DE5\u5177\u7814\u7A76";
  }
  return "\u672A\u5206\u7C7B\u5BFC\u5165";
}
function inferStorageWorkflow(source, textSample = "") {
  const corpus = `${source}
${textSample}`.toLowerCase();
  if (corpus.includes("architecture") || corpus.includes("\u7CFB\u7EDF\u67B6\u6784") || corpus.includes("draft")) {
    return "architecture";
  }
  if (corpus.includes("comment") || corpus.includes("comments") || corpus.includes("\u8BC4\u8BBA")) {
    return "comment-analysis";
  }
  if (corpus.includes("report") || corpus.includes("\u5206\u6790")) {
    return "analysis";
  }
  if (corpus.includes("sop")) {
    return "workflow-sop";
  }
  return "reference";
}
function inferStorageStage(source, textSample = "") {
  const corpus = `${source}
${textSample}`.toLowerCase();
  if (corpus.includes("draft") || corpus.includes("\u8349\u7A3F")) {
    return "draft";
  }
  if (corpus.includes("final") || corpus.includes("\u6B63\u5F0F")) {
    return "final";
  }
  if (corpus.includes("report") || corpus.includes("analysis") || corpus.includes("\u7814\u7A76")) {
    return "research";
  }
  if (corpus.includes("runtime")) {
    return "runtime";
  }
  return "reference";
}
function storageDestinationForImport(input) {
  const assetBase = storageSeriesPaths().assetBase;
  const projectRoot = path7.join(assetBase, "projects", input.projectFolder);
  if (input.isDirectory) {
    return path7.join(projectRoot, "incoming", "directories", sanitizeSegment(path7.basename(input.source), "directory"));
  }
  if (input.fileType === "image") {
    return path7.join(projectRoot, "raw", "images", sanitizeSegment(path7.basename(input.source), "image"));
  }
  if (input.fileType === "video") {
    return path7.join(projectRoot, "raw", "videos", sanitizeSegment(path7.basename(input.source), "video"));
  }
  if (input.fileType === "data") {
    return path7.join(projectRoot, "research", input.stage, sanitizeSegment(path7.basename(input.source), "data"));
  }
  if (input.fileType === "document") {
    return path7.join(projectRoot, "research", input.stage, sanitizeSegment(path7.basename(input.source), "document"));
  }
  if (input.fileType === "knowledge") {
    return path7.join(projectRoot, "references", input.workflow, input.stage, sanitizeSegment(path7.basename(input.source), "note"));
  }
  return path7.join(projectRoot, "misc", input.stage, sanitizeSegment(path7.basename(input.source), "file"));
}
function normalizeStorageWorkflow(value) {
  const normalized = value.trim().toLowerCase();
  return normalized || "reference";
}
function normalizeStorageStage(value) {
  const normalized = value.trim().toLowerCase();
  const allowed = /* @__PURE__ */ new Set(["inbox", "draft", "research", "reference", "runtime", "final"]);
  return allowed.has(normalized) ? normalized : "reference";
}
function normalizeStorageProjectFolder(value) {
  return sanitizeSegment(value, "\u672A\u5206\u7C7B\u5BFC\u5165");
}
function normalizeClassifiedAsToFileType(value) {
  if (value === "link-video") return "video";
  if (value === "link-reference") return "knowledge";
  return value;
}
function storageClassificationSummary(input) {
  const memoryRule = matchStorageProjectMemory(input.source, input.textSample ?? "");
  const projectFolder = memoryRule?.projectFolder ?? inferStorageProjectFolder(input.source, input.textSample);
  const workflow = memoryRule?.workflow ?? inferStorageWorkflow(input.source, input.textSample);
  const stage = memoryRule?.stage ?? inferStorageStage(input.source, input.textSample);
  const destination = storageDestinationForImport({
    source: input.source,
    fileType: input.fileType,
    projectFolder,
    workflow,
    stage,
    isDirectory: input.isDirectory
  });
  const confidence = projectFolder === "\u672A\u5206\u7C7B\u5BFC\u5165" || workflow === "reference" ? "low" : stage === "reference" ? "medium" : "high";
  return {
    projectFolder,
    workflow,
    stage,
    destination,
    confidence,
    matchedByMemory: Boolean(memoryRule)
  };
}
function isTextSearchableAsset(targetPath) {
  const ext = path7.extname(targetPath).toLowerCase();
  return [".md", ".txt", ".json", ".csv", ".yaml", ".yml"].includes(ext);
}
function inferProjectSeriesFromPath(targetPath) {
  const normalized = targetPath.split(path7.sep);
  const assetsIndex = normalized.lastIndexOf("assets");
  const knowledgeIndex = normalized.lastIndexOf("knowledge");
  if (assetsIndex >= 0 && normalized[assetsIndex + 1]) {
    return normalized[assetsIndex + 1];
  }
  if (knowledgeIndex >= 0 && normalized[knowledgeIndex + 2]) {
    return normalized[knowledgeIndex + 2];
  }
  return "";
}
function inferPlatformFromPath(targetPath) {
  const lower = targetPath.toLowerCase();
  if (lower.includes("douyin")) return "douyin";
  if (lower.includes("xiaohongshu")) return "xiaohongshu";
  if (lower.includes("mission-control")) return "mission-control";
  return "";
}
function searchAssetEntries(options) {
  const assetRoot = path7.join(path7.resolve(readAgentOsConfig().assetRootPath), "assets");
  if (!fs7.existsSync(assetRoot)) {
    return [];
  }
  const results = [];
  const normalizedQuery = options.query.toLowerCase();
  const walk = (dirPath) => {
    for (const entry of fs7.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path7.join(dirPath, entry.name);
      const isDirectory = entry.isDirectory();
      const fileType = classifyStorageFileType(fullPath, isDirectory);
      const projectSeries = inferProjectSeriesFromPath(fullPath);
      const platform = inferPlatformFromPath(fullPath);
      if (options.type !== "all" && fileType !== options.type) {
        if (isDirectory) {
          walk(fullPath);
        }
        continue;
      }
      if (options.platform !== "all" && platform !== options.platform) {
        if (isDirectory) {
          walk(fullPath);
        }
        continue;
      }
      if (options.projectSeries && projectSeries !== options.projectSeries) {
        if (isDirectory) {
          walk(fullPath);
        }
        continue;
      }
      const searchCorpus = [entry.name, fullPath];
      if (!isDirectory && isTextSearchableAsset(fullPath)) {
        try {
          searchCorpus.push(fs7.readFileSync(fullPath, "utf-8").slice(0, 5e3));
        } catch {
        }
      }
      const matches = searchCorpus.some((value) => value.toLowerCase().includes(normalizedQuery));
      if (matches) {
        const stats = fs7.statSync(fullPath);
        results.push({
          id: `asset-${fullPath}`,
          title: entry.name,
          kind: "asset",
          fileType,
          resultClass: fullPath.includes(`${path7.sep}deliverables${path7.sep}`) ? "deliverable" : fullPath.includes(`${path7.sep}raw${path7.sep}`) ? "raw" : "asset",
          path: fullPath,
          summary: isDirectory ? "\u76EE\u5F55\u7ED3\u679C" : fullPath,
          updatedAt: new Date(stats.mtimeMs).toISOString(),
          projectSeries,
          platform
        });
      }
      if (isDirectory) {
        walk(fullPath);
      }
    }
  };
  walk(assetRoot);
  return results.slice(0, 60);
}
function searchKnowledgeEntries(options) {
  const normalizedQuery = options.query.trim().toLowerCase();
  const wantsTaskLogs = normalizedQuery.includes("task_") || normalizedQuery.includes("runtime") || normalizedQuery.includes("\u65E5\u5FD7") || normalizedQuery.includes("log") || normalizedQuery.includes("\u6559\u8BAD") || normalizedQuery.includes("lesson") || normalizedQuery.includes("\u53CD\u9988");
  const results = searchKnowledge(options.query).map((item) => {
    const docLink = item.human.links?.find((link) => link.url.startsWith("/api/v1/doc?path="));
    const pathValue = docLink ? decodeURIComponent(docLink.url.replace("/api/v1/doc?path=", "")) : "";
    return {
      id: item.id,
      title: item.human.title,
      kind: "knowledge",
      fileType: "knowledge",
      resultClass: item.knowledgeType === "runtime-lesson" || pathValue.replace(/\\/g, "/").includes("/agents/knowledge/runtime-lessons/") || pathValue.replace(/\\/g, "/").includes("/agents/knowledge/cases/task_") ? "runtime-log" : "knowledge",
      path: pathValue,
      summary: item.human.summary,
      updatedAt: item.updatedAt ?? "",
      projectSeries: inferProjectSeriesFromPath(pathValue),
      platform: item.human.platform.toLowerCase(),
      linkedKnowledgePath: pathValue || void 0,
      knowledgeType: item.knowledgeType ?? ""
    };
  }).filter((item) => {
    const normalizedPath = item.path.replace(/\\/g, "/");
    const isRuntimeLesson = item.knowledgeType === "runtime-lesson" || normalizedPath.includes("/agents/knowledge/runtime-lessons/");
    const isTaskCase = normalizedPath.includes("/agents/knowledge/cases/task_") || /^task_/i.test(normalizedPath.split("/").pop() ?? "");
    const isFeedbackLog = item.knowledgeType === "feedback" || normalizedPath.includes("/agents/knowledge/feedback/");
    if (!wantsTaskLogs && (isRuntimeLesson || isTaskCase || isFeedbackLog)) {
      return false;
    }
    if (options.platform !== "all" && item.platform !== options.platform) {
      return false;
    }
    if (options.projectSeries && item.projectSeries !== options.projectSeries) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    const aPath = a.path.replace(/\\/g, "/");
    const bPath = b.path.replace(/\\/g, "/");
    const aScore = (aPath.includes("/knowledge/projects/") ? 0 : 1) + (aPath.includes("/assets/") ? 0 : 1);
    const bScore = (bPath.includes("/knowledge/projects/") ? 0 : 1) + (bPath.includes("/assets/") ? 0 : 1);
    if (aScore !== bScore) {
      return aScore - bScore;
    }
    return Date.parse(b.updatedAt || "") - Date.parse(a.updatedAt || "");
  });
  return results.slice(0, 60);
}
function newestFileMatching(dirPath, fileName) {
  if (!fs7.existsSync(dirPath)) {
    return null;
  }
  let latest = null;
  const walk = (currentDir) => {
    for (const entry of fs7.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path7.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile() || entry.name !== fileName) {
        continue;
      }
      const stats = fs7.statSync(fullPath);
      if (!latest || stats.mtimeMs > latest.mtimeMs) {
        latest = { path: fullPath, mtimeMs: stats.mtimeMs };
      }
    }
  };
  walk(dirPath);
  return latest;
}
function artifactFromRecord(label, record) {
  if (!record) {
    return null;
  }
  return {
    label,
    path: record.path,
    updatedAt: new Date(record.mtimeMs).toISOString()
  };
}
function buildShortVideoFactoryState() {
  const libraryRootConfig = readAgentOsConfig().assetRootPath;
  const seriesRoot = path7.join(libraryRootConfig, "assets", DEFAULT_SHORT_VIDEO_SERIES);
  const latestSampleBatch = artifactFromRecord(
    "\u6837\u672C\u6279\u6B21",
    newestFileMatching(seriesRoot, "sample_manifest.json")
  );
  const latestResearchBundle = artifactFromRecord(
    "\u8D26\u53F7\u7814\u7A76\u5305",
    newestFileMatching(seriesRoot, "account_research_bundle.json")
  );
  const latestCreativeBrief = artifactFromRecord(
    "Creative Brief",
    newestFileMatching(seriesRoot, "creative_brief.json")
  );
  const latestProductionPack = artifactFromRecord(
    "\u53D1\u5E03\u5305",
    newestFileMatching(seriesRoot, "publish_pack__draft.md")
  );
  const latestRoughCut = artifactFromRecord(
    "\u7C97\u526A\u7247",
    newestFileMatching(seriesRoot, "rough_cut.mp4")
  );
  const latestInspirationRecord = artifactFromRecord(
    "\u6536\u85CF\u6D1E\u5BDF",
    newestFileMatching(seriesRoot, "\u6D1E\u5BDF\u8BB0\u5F55__runtime.md")
  );
  const latestNotebookSummary = artifactFromRecord(
    "NotebookLM \u5F52\u7EB3",
    newestFileMatching(seriesRoot, "notebooklm_summary__runtime.md")
  );
  const latestNotebookEnhancedBrief = artifactFromRecord(
    "NotebookLM \u589E\u5F3A Brief",
    newestFileMatching(seriesRoot, "notebooklm_enhanced_brief.json")
  );
  const geminiConsentGranted = fs7.existsSync(geminiConsentPath) && (() => {
    try {
      const payload = JSON.parse(fs7.readFileSync(geminiConsentPath, "utf-8"));
      return payload.accepted === true && payload.disclaimerVersion === "1.0";
    } catch {
      return false;
    }
  })();
  let notebooklmAvailable = fs7.existsSync(notebookLmStatePath);
  if (fs7.existsSync(notebookLmValidationPath)) {
    try {
      const validation = JSON.parse(fs7.readFileSync(notebookLmValidationPath, "utf-8"));
      if (validation.valid === false) {
        notebooklmAvailable = false;
      }
    } catch {
    }
  }
  let notebookStatus = notebooklmAvailable ? "missing" : "unavailable";
  let notebookSourceSyncAt = null;
  let notebookEnhancedBriefPath = latestNotebookEnhancedBrief?.path ?? null;
  if (fs7.existsSync(NOTEBOOKLM_ACCOUNT_MAP)) {
    try {
      const mapping = JSON.parse(fs7.readFileSync(NOTEBOOKLM_ACCOUNT_MAP, "utf-8"));
      const latestEntry = Object.values(mapping.accounts ?? {}).filter((entry) => entry.last_synced_at).sort((a, b) => Date.parse(b.last_synced_at ?? "") - Date.parse(a.last_synced_at ?? ""))[0];
      if (latestEntry?.last_synced_at) {
        notebookSourceSyncAt = latestEntry.last_synced_at;
        notebookStatus = "sources_synced";
      }
    } catch {
    }
  }
  if (latestNotebookSummary) {
    notebookStatus = "nblm_summary_ready";
  }
  if (latestNotebookEnhancedBrief) {
    notebookStatus = "enhanced_brief_ready";
  }
  const researchReady = Boolean(latestSampleBatch);
  const creativeReady = Boolean(latestResearchBundle) && (!latestCreativeBrief || Date.parse(latestCreativeBrief.updatedAt ?? "") < Date.parse(latestResearchBundle.updatedAt ?? ""));
  const productionReady = Boolean(latestCreativeBrief) && (!latestProductionPack || Date.parse(latestProductionPack.updatedAt ?? "") < Date.parse(latestCreativeBrief.updatedAt ?? ""));
  return {
    defaultSeries: DEFAULT_SHORT_VIDEO_SERIES,
    defaultInstance: shortVideoDefaultInstance(),
    minSampleSize: DEFAULT_SHORT_VIDEO_MIN_SAMPLE_SIZE,
    defaultSampleSize: DEFAULT_SHORT_VIDEO_SAMPLE_SIZE,
    latestSampleBatch,
    latestResearchBundle,
    latestCreativeBrief,
    latestProductionPack,
    latestRoughCut,
    latestInspirationRecord,
    latestNotebookSummary,
    latestNotebookEnhancedBrief,
    geminiConsentGranted,
    notebooklmAvailable,
    notebookStatus,
    notebookSourceSyncAt,
    notebookEnhancedBriefPath,
    gates: [
      {
        id: "pilot-account",
        label: "\u8D26\u53F7\u8BD5\u70B9",
        status: latestSampleBatch ? "completed" : "pending",
        detail: latestSampleBatch ? `\u5DF2\u5EFA\u7ACB\u6837\u672C\u6279\u6B21\uFF1A${latestSampleBatch.path}` : "\u5148\u5BFC\u5165\u4E00\u4E2A 3-5 \u6761\u6837\u672C\u7684\u8D26\u53F7\u6279\u6B21\u3002"
      },
      {
        id: "research-to-production",
        label: "\u7814\u7A76\u8F6C\u751F\u4EA7",
        status: creativeReady ? "ready" : latestResearchBundle ? "completed" : researchReady ? "ready" : "pending",
        detail: latestResearchBundle ? "\u8D26\u53F7\u7814\u7A76\u8D44\u4EA7\u5DF2\u751F\u6210\uFF0C\u53EF\u4EE5\u9009\u62E9\u8FDB\u5165\u751F\u4EA7\u94FE\u3002" : researchReady ? "\u6837\u672C\u6279\u6B21\u5DF2\u5C31\u7EEA\uFF0C\u4E0B\u4E00\u6B65\u8FD0\u884C\u8D26\u53F7\u7814\u7A76\u3002" : "\u7B49\u5F85\u6837\u672C\u6279\u6B21\u5EFA\u7ACB\u3002"
      },
      {
        id: "director-plan",
        label: "\u5BFC\u6F14\u65B9\u6848",
        status: productionReady ? "ready" : latestProductionPack ? "completed" : latestCreativeBrief ? "ready" : "pending",
        detail: latestCreativeBrief ? "Creative Brief \u5DF2\u751F\u6210\uFF0C\u53EF\u4EE5\u542F\u52A8\u5BFC\u6F14\u4E0E\u751F\u4EA7\u94FE\u3002" : "\u5148\u5B8C\u6210 creative brief\uFF0C\u518D\u8FDB\u5165\u5BFC\u6F14\u9636\u6BB5\u3002"
      },
      {
        id: "gemini-consent",
        label: "Gemini \u589E\u5F3A\u5206\u6790",
        status: geminiConsentGranted ? "completed" : "blocked",
        detail: geminiConsentGranted ? "Gemini Web consent \u5DF2\u786E\u8BA4\uFF0C\u53EF\u6309\u9700\u52A0\u5165\u589E\u5F3A\u5206\u6790\u3002" : "\u5C1A\u672A\u5B8C\u6210 Gemini Web consent\uFF0C\u589E\u5F3A\u89C6\u89C9\u5206\u6790\u9ED8\u8BA4\u5173\u95ED\u3002"
      },
      {
        id: "notebooklm",
        label: "NotebookLM \u5F52\u7EB3",
        status: !notebooklmAvailable ? "blocked" : notebookStatus === "enhanced_brief_ready" ? "completed" : notebookStatus === "nblm_summary_ready" || notebookStatus === "sources_synced" ? "ready" : "pending",
        detail: !notebooklmAvailable ? "NotebookLM \u5F53\u524D\u4E0D\u53EF\u7528\uFF0C\u4F46\u4E0D\u5F71\u54CD\u57FA\u7840\u94FE\u8FD0\u884C\u3002" : notebookStatus === "enhanced_brief_ready" ? `\u589E\u5F3A\u7248 brief \u5DF2\u751F\u6210\uFF1A${latestNotebookEnhancedBrief?.path ?? ""}` : notebookStatus === "nblm_summary_ready" ? `NotebookLM \u603B\u7ED3\u5DF2\u751F\u6210\uFF1A${latestNotebookSummary?.path ?? ""}` : notebookStatus === "sources_synced" ? `Notebook \u4E0E source \u5DF2\u540C\u6B65\uFF0C\u6700\u8FD1\u540C\u6B65\u65F6\u95F4\uFF1A${notebookSourceSyncAt}` : "NotebookLM \u5F53\u524D\u53EF\u7528\uFF0C\u53EF\u4F5C\u4E3A\u8D26\u53F7\u7EA7\u589E\u5F3A\u5F52\u7EB3\u5C42\u3002"
      }
    ]
  };
}
function buildStorageImportItemSummary(input) {
  return input;
}
function renderStorageImportNote(importedAt, summary, note, items) {
  return [
    "# \u5BFC\u5165\u8BB0\u5F55",
    "",
    `- \u65F6\u95F4\uFF1A${importedAt}`,
    `- \u6458\u8981\uFF1A${summary}`,
    note ? `- \u5907\u6CE8\uFF1A${note}` : "",
    "",
    "## \u5206\u7C7B\u7ED3\u679C",
    "",
    ...items.map(
      (item) => `- ${item.source} -> \u9879\u76EE:${item.projectFolder ?? "-"} / \u6D41\u7A0B:${item.workflow ?? "-"} / \u9636\u6BB5:${item.stage ?? "-"} / \u7C7B\u578B:${item.classifiedAs} / \u5B58\u653E:${item.targetBucket}${item.correctedManually ? " / \u4EBA\u5DE5\u7EA0\u504F" : ""}${item.matchedByMemory ? " / \u8BB0\u5FC6\u547D\u4E2D" : ""}${item.warning ? ` / ${item.warning}` : ""}`
    )
  ].filter(Boolean).join("\n");
}
function moveFilePreservingContents(sourcePath, destinationPath) {
  if (sourcePath === destinationPath) {
    return destinationPath;
  }
  ensureDir(path7.dirname(destinationPath));
  try {
    fs7.renameSync(sourcePath, destinationPath);
  } catch {
    fs7.copyFileSync(sourcePath, destinationPath);
    fs7.unlinkSync(sourcePath);
  }
  return destinationPath;
}
function createStorageImportRecord(payload) {
  const paths = storageSeriesPaths();
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const importDir = path7.join(storageImportRoot(), `import-${stamp}`);
  const filesDir = path7.join(importDir, "files");
  ensureDir(filesDir);
  const items = [];
  for (const file of payload.files) {
    const fileType = classifyStorageFileType(file.name, false);
    const textSample = decodeImportTextSample(file.name, file.contentBase64);
    const classification = storageClassificationSummary({
      source: file.relativePath,
      sourceKind: "upload",
      fileType,
      textSample
    });
    const targetBucket = classification.destination.replace(`${storageSeriesPaths().assetBase}${path7.sep}`, "");
    const destination = classification.destination;
    ensureDir(path7.dirname(destination));
    fs7.writeFileSync(destination, Buffer.from(file.contentBase64, "base64"));
    items.push(
      buildStorageImportItemSummary({
        source: file.relativePath,
        sourceKind: "upload",
        classifiedAs: fileType,
        projectFolder: classification.projectFolder,
        workflow: classification.workflow,
        stage: classification.stage,
        matchedByMemory: classification.matchedByMemory,
        targetBucket,
        action: "copied",
        confidence: classification.confidence,
        storedAt: destination,
        warning: classification.confidence === "low" ? "\u7CFB\u7EDF\u80FD\u8BC6\u522B\u5230\u5927\u65B9\u5411\uFF0C\u4F46\u9879\u76EE\u6216\u9636\u6BB5\u7F6E\u4FE1\u5EA6\u8F83\u4F4E\uFF1B\u5982\u679C\u653E\u5F97\u4E0D\u5BF9\uFF0C\u8BF7\u5728\u4EFB\u52A1\u8BB0\u5F55\u91CC\u53CD\u9988\u3002" : void 0
      })
    );
    rememberStorageClassification({
      source: file.relativePath,
      textSample,
      sourceKind: "upload",
      projectFolder: classification.projectFolder,
      workflow: classification.workflow,
      stage: classification.stage
    });
  }
  for (const entry of payload.pathEntries) {
    const resolved = path7.resolve(entry);
    if (!fs7.existsSync(resolved)) {
      items.push(
        buildStorageImportItemSummary({
          source: entry,
          sourceKind: "path",
          classifiedAs: "missing",
          targetBucket: "invalid",
          action: "referenced",
          confidence: "low",
          warning: "\u8DEF\u5F84\u4E0D\u5B58\u5728\uFF0C\u672A\u5BFC\u5165\u3002"
        })
      );
      continue;
    }
    const stats = fs7.statSync(resolved);
    const fileType = classifyStorageFileType(resolved, stats.isDirectory());
    const textSample = !stats.isDirectory() && isTextSearchableAsset(resolved) ? fs7.readFileSync(resolved, "utf-8").slice(0, 6e3) : "";
    const classification = storageClassificationSummary({
      source: resolved,
      sourceKind: "path",
      fileType,
      textSample,
      isDirectory: stats.isDirectory()
    });
    items.push(
      buildStorageImportItemSummary({
        source: resolved,
        sourceKind: "path",
        classifiedAs: fileType,
        projectFolder: classification.projectFolder,
        workflow: classification.workflow,
        stage: classification.stage,
        matchedByMemory: classification.matchedByMemory,
        targetBucket: classification.destination.replace(`${storageSeriesPaths().assetBase}${path7.sep}`, ""),
        action: stats.isDirectory() ? "referenced" : "copied",
        confidence: classification.confidence,
        storedAt: stats.isDirectory() ? void 0 : (() => {
          const destination = classification.destination;
          ensureDir(path7.dirname(destination));
          fs7.copyFileSync(resolved, destination);
          return destination;
        })(),
        warning: stats.isDirectory() ? "\u76EE\u5F55\u5F53\u524D\u53EA\u767B\u8BB0\u5F15\u7528\uFF0C\u5EFA\u8BAE\u5728\u201C\u6574\u7406\u201D\u91CC\u7EE7\u7EED\u505A\u5F52\u6863\u4E0E\u7D22\u5F15\u3002" : classification.confidence === "low" ? "\u7CFB\u7EDF\u80FD\u8BC6\u522B\u5230\u5927\u65B9\u5411\uFF0C\u4F46\u9879\u76EE\u6216\u9636\u6BB5\u7F6E\u4FE1\u5EA6\u8F83\u4F4E\uFF1B\u5982\u679C\u653E\u5F97\u4E0D\u5BF9\uFF0C\u8BF7\u5728\u4EFB\u52A1\u8BB0\u5F55\u91CC\u53CD\u9988\u3002" : void 0
      })
    );
    rememberStorageClassification({
      source: resolved,
      textSample,
      sourceKind: "path",
      projectFolder: classification.projectFolder,
      workflow: classification.workflow,
      stage: classification.stage
    });
  }
  for (const entry of payload.linkEntries) {
    const platform = detectShortVideoPlatform(entry);
    const classification = storageClassificationSummary({
      source: entry,
      sourceKind: "link",
      fileType: platform !== "unknown" ? "video" : "knowledge"
    });
    items.push(
      buildStorageImportItemSummary({
        source: entry,
        sourceKind: "link",
        classifiedAs: platform !== "unknown" ? "link-video" : "link-reference",
        projectFolder: classification.projectFolder,
        workflow: classification.workflow,
        stage: classification.stage,
        matchedByMemory: classification.matchedByMemory,
        targetBucket: platform !== "unknown" ? "links/video-candidates" : classification.destination.replace(`${storageSeriesPaths().assetBase}${path7.sep}`, ""),
        action: "referenced",
        confidence: platform !== "unknown" ? "medium" : classification.confidence,
        warning: platform !== "unknown" ? "\u5DF2\u8BC6\u522B\u4E3A\u77ED\u89C6\u9891\u94FE\u63A5\uFF0C\u53EF\u7EE7\u7EED\u9001\u53BB\u201C\u6536\u85CF\u89C6\u9891\u6D1E\u5BDF\u201D\u6216\u77ED\u89C6\u9891\u5DE5\u5382\u3002" : "\u666E\u901A\u94FE\u63A5\u5DF2\u6309\u53C2\u8003\u8D44\u6599\u5DE5\u4F5C\u6D41\u767B\u8BB0\uFF1B\u5982\u679C\u5F52\u5C5E\u4E0D\u5BF9\uFF0C\u8BF7\u5728\u4EFB\u52A1\u8BB0\u5F55\u91CC\u53CD\u9988\u3002"
      })
    );
    rememberStorageClassification({
      source: entry,
      sourceKind: "link",
      projectFolder: classification.projectFolder,
      workflow: classification.workflow,
      stage: classification.stage
    });
  }
  const importedAt = (/* @__PURE__ */ new Date()).toISOString();
  const manifestPath = path7.join(importDir, "import_manifest.json");
  const knowledgeNotePath = path7.join(
    paths.knowledgeBase,
    "references",
    "storage-retrieval",
    `import-${stamp}`,
    "\u5BFC\u5165\u8BB0\u5F55__runtime.md"
  );
  ensureDir(path7.dirname(knowledgeNotePath));
  const summary = `\u5DF2\u8BB0\u5F55 ${items.length} \u9879\u5BFC\u5165\u5185\u5BB9\uFF0C\u5176\u4E2D ${items.filter((item) => item.action === "copied").length} \u9879\u5DF2\u590D\u5236\uFF0C${items.filter((item) => item.action === "referenced").length} \u9879\u6309\u5F15\u7528\u767B\u8BB0\u3002`;
  fs7.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        importedAt,
        note: payload.note ?? "",
        summary,
        items
      },
      null,
      2
    ),
    "utf-8"
  );
  fs7.writeFileSync(
    knowledgeNotePath,
    renderStorageImportNote(importedAt, summary, payload.note ?? "", items),
    "utf-8"
  );
  return {
    success: true,
    summary,
    manifestPath,
    knowledgeNotePath,
    importedAt,
    items
  };
}
function fetchStorageImportRecent() {
  const root = storageImportRoot();
  if (!fs7.existsSync(root)) {
    return [];
  }
  const manifests = newestFileMatching(root, "import_manifest.json");
  const records = [];
  const walk = (dirPath) => {
    for (const entry of fs7.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path7.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile() || entry.name !== "import_manifest.json") {
        continue;
      }
      try {
        const payload = JSON.parse(fs7.readFileSync(fullPath, "utf-8"));
        const dirName = path7.basename(path7.dirname(fullPath));
        const knowledgeNotePath = path7.join(
          storageSeriesPaths().knowledgeBase,
          "references",
          "storage-retrieval",
          dirName,
          "\u5BFC\u5165\u8BB0\u5F55__runtime.md"
        );
        records.push({
          id: dirName,
          importedAt: payload.importedAt ?? "",
          manifestPath: fullPath,
          knowledgeNotePath: fs7.existsSync(knowledgeNotePath) ? knowledgeNotePath : void 0,
          summary: payload.summary ?? dirName
        });
      } catch {
      }
    }
  };
  walk(root);
  return records.sort((a, b) => Date.parse(b.importedAt) - Date.parse(a.importedAt)).slice(0, 12);
}
function storageKnowledgeNotePathFromManifest(manifestPath) {
  const importId = path7.basename(path7.dirname(manifestPath));
  return path7.join(
    storageSeriesPaths().knowledgeBase,
    "references",
    "storage-retrieval",
    importId,
    "\u5BFC\u5165\u8BB0\u5F55__runtime.md"
  );
}
function reclassifyStorageImportItem(payload) {
  const manifestPath = path7.resolve(payload.manifestPath);
  if (!fs7.existsSync(manifestPath)) {
    throw new Error("Import manifest not found");
  }
  const manifest = JSON.parse(fs7.readFileSync(manifestPath, "utf-8"));
  const items = manifest.items ?? [];
  const item = items[payload.itemIndex];
  if (!item) {
    throw new Error("Import item not found");
  }
  const projectFolder = normalizeStorageProjectFolder(payload.projectFolder);
  const workflow = normalizeStorageWorkflow(payload.workflow);
  const stage = normalizeStorageStage(payload.stage);
  const fileType = normalizeClassifiedAsToFileType(item.classifiedAs);
  const destination = storageDestinationForImport({
    source: item.source,
    fileType,
    projectFolder,
    workflow,
    stage,
    isDirectory: false
  });
  let storedAt = item.storedAt;
  if (storedAt && fs7.existsSync(storedAt)) {
    storedAt = moveFilePreservingContents(storedAt, destination);
  }
  const updatedItem = buildStorageImportItemSummary({
    ...item,
    projectFolder,
    workflow,
    stage,
    matchedByMemory: false,
    correctedManually: true,
    targetBucket: destination.replace(`${storageSeriesPaths().assetBase}${path7.sep}`, ""),
    storedAt,
    confidence: "high",
    warning: void 0
  });
  items[payload.itemIndex] = updatedItem;
  rememberStorageClassification({
    source: item.source,
    sourceKind: item.sourceKind,
    projectFolder,
    workflow,
    stage
  });
  const nextSummary = `\u5DF2\u8BB0\u5F55 ${items.length} \u9879\u5BFC\u5165\u5185\u5BB9\uFF0C\u5176\u4E2D ${items.filter((entry) => entry.action === "copied").length} \u9879\u5DF2\u590D\u5236\uFF0C${items.filter((entry) => entry.action === "referenced").length} \u9879\u6309\u5F15\u7528\u767B\u8BB0\u3002`;
  const nextManifest = {
    importedAt: manifest.importedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    note: manifest.note ?? "",
    summary: nextSummary,
    items
  };
  fs7.writeFileSync(manifestPath, JSON.stringify(nextManifest, null, 2), "utf-8");
  const knowledgeNotePath = storageKnowledgeNotePathFromManifest(manifestPath);
  ensureDir(path7.dirname(knowledgeNotePath));
  fs7.writeFileSync(
    knowledgeNotePath,
    renderStorageImportNote(nextManifest.importedAt, nextSummary, nextManifest.note, items),
    "utf-8"
  );
  return {
    success: true,
    summary: nextSummary,
    manifestPath,
    knowledgeNotePath,
    importedAt: nextManifest.importedAt,
    items,
    updatedItem
  };
}
function ensureTaskRuntimeDir() {
  fs7.mkdirSync(path7.dirname(taskHistoryPath), { recursive: true });
}
function readInputProfiles() {
  if (!fs7.existsSync(inputProfilesPath)) {
    return {};
  }
  try {
    return JSON.parse(fs7.readFileSync(inputProfilesPath, "utf-8"));
  } catch {
    return {};
  }
}
function writeInputProfiles(store) {
  ensureTaskRuntimeDir();
  fs7.writeFileSync(inputProfilesPath, JSON.stringify(store, null, 2), "utf-8");
}
function sanitizeProfileValues(values) {
  const next = {};
  for (const [key, value] of Object.entries(values)) {
    next[key] = value ?? "";
  }
  return next;
}
function readMarkdownFiles(dirPath) {
  if (!fs7.existsSync(dirPath)) {
    return [];
  }
  return fs7.readdirSync(dirPath, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md")).map((entry) => path7.join(dirPath, entry.name)).sort();
}
function parseJsonBlock(text, heading) {
  const regex = new RegExp(`##\\s+${heading}\\s*\\n\\n\\\`\\\`\\\`json\\n([\\s\\S]*?)\\n\\\`\\\`\\\``, "i");
  const match = text.match(regex);
  if (!match) {
    return {};
  }
  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
}
function parseTextBlock(text, heading) {
  const regex = new RegExp(`##\\s+${heading}\\s*\\n\\n\\\`\\\`\\\`text\\n([\\s\\S]*?)\\n\\\`\\\`\\\``, "i");
  return text.match(regex)?.[1]?.trim() ?? "";
}
function backfillTaskHistoryFromKnowledge() {
  const files = [
    ...readMarkdownFiles(knowledgeCasesRoot).map((file) => ({ file, status: "completed" })),
    ...readMarkdownFiles(runtimeLessonsRoot).map((file) => ({ file, status: "failed" }))
  ];
  return files.map(({ file, status }) => {
    const markdown = fs7.readFileSync(file, "utf-8");
    const id = markdown.match(/^id:\s*(.+)$/m)?.[1]?.trim();
    const nodeId = markdown.match(/^node_id:\s*(.+)$/m)?.[1]?.trim();
    const updatedAtRaw = markdown.match(/^updated_at:\s*(.+)$/m)?.[1]?.trim();
    const title = markdown.match(/^#\s+(.+?)\s+(?:运行案例|运行教训)$/m)?.[1]?.trim();
    const command = markdown.match(/##\s+Command\s*\n\n`([^`]+)`/m)?.[1]?.trim() ?? "";
    const inputs = parseJsonBlock(markdown, "Inputs");
    const output = parseTextBlock(markdown, status === "completed" ? "Result" : "Output");
    if (!id || !nodeId || !title) {
      return null;
    }
    const updatedAt = updatedAtRaw ? Date.parse(updatedAtRaw) || now() : now();
    return {
      id,
      nodeId,
      nodeLabel: title,
      familyId: taskFamilyId(nodeId),
      familyLabel: title,
      command,
      status,
      createdAt: updatedAt,
      updatedAt,
      agentId: "openclaw-resident-agent",
      resultSummary: status === "completed" ? `${title} finished successfully.` : `${title} failed.`,
      resultDetail: output,
      context: {
        inputValues: inputs,
        sourcePath: file
      }
    };
  }).filter(Boolean).map((task) => normalizeTask(task));
}
function readTaskHistory() {
  if (!fs7.existsSync(taskHistoryPath)) {
    const backfilled = backfillTaskHistoryFromKnowledge();
    if (backfilled.length > 0) {
      writeTaskHistory(backfilled);
    }
    return backfilled;
  }
  try {
    const parsed = JSON.parse(fs7.readFileSync(taskHistoryPath, "utf-8"));
    if (parsed.length === 0) {
      const backfilled = backfillTaskHistoryFromKnowledge();
      if (backfilled.length > 0) {
        writeTaskHistory(backfilled);
      }
      return backfilled;
    }
    return parsed.map((task) => normalizeTask(task));
  } catch {
    return backfillTaskHistoryFromKnowledge();
  }
}
function writeTaskHistory(tasks) {
  ensureTaskRuntimeDir();
  fs7.writeFileSync(taskHistoryPath, JSON.stringify(tasks, null, 2), "utf-8");
}
function readDecisionState() {
  if (!fs7.existsSync(decisionStatePath)) {
    return {};
  }
  try {
    const parsed = JSON.parse(fs7.readFileSync(decisionStatePath, "utf-8"));
    const nowValue = Date.now();
    let changed = false;
    const next = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value.status === "snoozed" && value.snoozeUntil) {
        const until = Date.parse(value.snoozeUntil);
        if (Number.isFinite(until) && until <= nowValue) {
          changed = true;
          continue;
        }
      }
      next[key] = value;
    }
    if (changed) {
      writeDecisionState(next);
    }
    return next;
  } catch {
    return {};
  }
}
function writeDecisionState(state) {
  ensureTaskRuntimeDir();
  fs7.writeFileSync(decisionStatePath, JSON.stringify(state, null, 2), "utf-8");
}
function setDecisionState(decisionId, state) {
  const current = readDecisionState();
  if (state === null) {
    delete current[decisionId];
  } else {
    current[decisionId] = state;
  }
  writeDecisionState(current);
}
function findTaskById(taskId) {
  return [
    ...commandQueue.map((task) => normalizeTask(task)),
    ...readTaskHistory()
  ].find((task) => task.id === taskId);
}
function queueClonedTask(task) {
  const cloned = createTask(task.nodeId, task.command, task.context);
  commandQueue.push(cloned);
  persistTask(cloned);
  return cloned;
}
function persistTask(task) {
  const history = readTaskHistory();
  const next = history.filter((item) => item.id !== task.id);
  next.push(normalizeTask(task));
  next.sort((a, b) => b.updatedAt - a.updatedAt);
  writeTaskHistory(next.slice(0, 2e3));
}
function taskFamilyId(nodeId) {
  return `family-${nodeId}`;
}
function isSensitiveInputKey(key) {
  const normalized = key.toLowerCase();
  return normalized.includes("password") || normalized.includes("token") || normalized.includes("secret") || normalized.includes("\u6388\u6743") || normalized.includes("\u5BC6\u7801");
}
function redactInputValues(inputValues) {
  if (!inputValues) {
    return inputValues;
  }
  const sanitized = {};
  for (const [key, value] of Object.entries(inputValues)) {
    sanitized[key] = isSensitiveInputKey(key) && value ? "********" : value;
  }
  return sanitized;
}
function normalizeTask(task) {
  const executionMode = task.executionMode ?? inferExecutionMode(task.nodeId, task.command);
  return {
    ...task,
    familyId: task.familyId || taskFamilyId(task.nodeId),
    familyLabel: task.familyLabel || task.nodeLabel,
    executionMode,
    stage: task.stage ?? stageForStatus(task.status),
    evidenceLevel: task.evidenceLevel ?? (task.status === "completed" || task.status === "failed" ? "runtime" : "declared"),
    context: task.context ? {
      ...task.context,
      inputValues: redactInputValues(task.context.inputValues)
    } : task.context
  };
}
function groupTaskHistory(tasks) {
  const groups = /* @__PURE__ */ new Map();
  for (const task of tasks) {
    const familyId = task.familyId || taskFamilyId(task.nodeId);
    const bucket = groups.get(familyId) ?? [];
    bucket.push({
      ...task,
      familyId,
      familyLabel: task.familyLabel || task.nodeLabel
    });
    groups.set(familyId, bucket);
  }
  return [...groups.entries()].map(([familyId, groupTasks]) => {
    const sortedTasks = [...groupTasks].sort((a, b) => b.updatedAt - a.updatedAt);
    const latest = sortedTasks[0];
    const canonical = sortedTasks.find((item) => !item.nodeLabel.startsWith("\u81EA\u8FDB\u5316\uFF1A")) ?? latest;
    return {
      familyId,
      familyLabel: canonical.familyLabel || canonical.nodeLabel,
      nodeId: canonical.nodeId,
      latestUpdatedAt: latest.updatedAt,
      totalRuns: sortedTasks.length,
      completedRuns: sortedTasks.filter((item) => item.status === "completed").length,
      failedRuns: sortedTasks.filter((item) => item.status === "failed").length,
      tasks: sortedTasks.slice(0, 8)
    };
  }).sort((a, b) => b.latestUpdatedAt - a.latestUpdatedAt);
}
function taskTargetDir(task) {
  return task.context?.targetDir || task.context?.inputValues?.["\u76EE\u6807\u76EE\u5F55"] || task.context?.inputValues?.["targetDir"] || null;
}
function latestConfirmedKnowledgeForNode(nodeId) {
  return getKnowledgeDb().filter(
    (item) => item.evidenceLevel === "confirmed" && item.machine?.entities?.nodeId === nodeId
  ).sort((a, b) => Date.parse(b.updatedAt ?? "") - Date.parse(a.updatedAt ?? ""))[0];
}
function decisionTitleFromId(id) {
  if (id.startsWith("blocked:")) {
    return "Blocked Workflow";
  }
  if (id.startsWith("asset-root:")) {
    return "Asset Root Needed";
  }
  if (id.startsWith("evidence-stale:")) {
    return "Evidence Needs Refresh";
  }
  if (id.startsWith("failure-cluster:")) {
    return "Failure Cluster";
  }
  if (id.startsWith("follow-up:")) {
    return "Queued Follow-up";
  }
  return "Decision";
}
function buildShortVideoDecisions(state) {
  const items = [];
  if (state.latestSampleBatch && !state.latestResearchBundle) {
    items.push({
      id: "short-video:account-research",
      priority: "p1",
      title: "\u8D26\u53F7\u7814\u7A76\u5F85\u8FD0\u884C",
      reason: "\u6837\u672C\u6279\u6B21\u5DF2\u5EFA\u7ACB\uFF0C\u4F46\u8D26\u53F7\u7814\u7A76\u8FD8\u6CA1\u6709\u6B63\u5F0F\u751F\u6210\u3002",
      nextAction: "\u8FD0\u884C\u8D26\u53F7\u7814\u7A76\uFF0C\u5148\u628A\u5355\u6761 analysis bundle \u548C raw \u7814\u7A76\u5305\u4EA7\u51FA\u6765\u3002",
      status: "open",
      relatedNodeId: "short_video_account_research",
      refs: [
        {
          label: "Sample Manifest",
          value: state.latestSampleBatch.path,
          path: state.latestSampleBatch.path
        }
      ]
    });
  }
  if (state.latestResearchBundle && !state.latestCreativeBrief) {
    items.push({
      id: "short-video:creative-brief",
      priority: "p1",
      title: "\u662F\u5426\u7EB3\u5165\u751F\u4EA7",
      reason: "\u8D26\u53F7\u7814\u7A76\u5DF2\u7ECF\u5B8C\u6210\uFF0C\u4F46 creative brief \u8FD8\u6CA1\u6709\u751F\u6210\u3002",
      nextAction: "\u6311\u9009\u4E00\u4E2A\u503C\u5F97\u6A21\u4EFF\u7684\u6837\u672C\u6216\u6A21\u5F0F\uFF0C\u5E76\u751F\u6210 creative brief\u3002",
      status: "open",
      relatedNodeId: "short_video_creative_brief",
      refs: [
        {
          label: "Research Bundle",
          value: state.latestResearchBundle.path,
          path: state.latestResearchBundle.path
        }
      ]
    });
  }
  if (state.latestCreativeBrief && !state.latestProductionPack) {
    items.push({
      id: "short-video:director",
      priority: "p1",
      title: "\u5BFC\u6F14\u65B9\u6848\u786E\u8BA4",
      reason: "Creative brief \u5DF2\u7ECF\u5230\u4F4D\uFF0C\u4F46\u5BFC\u6F14\u4E0E\u751F\u4EA7\u94FE\u8FD8\u6CA1\u6709\u6B63\u5F0F\u542F\u52A8\u3002",
      nextAction: "\u786E\u8BA4\u771F\u4EBA\u53E3\u64AD\u6BB5\u3001AI \u8865\u955C\u6BB5\u548C\u76EE\u6807\u65F6\u957F\uFF0C\u7136\u540E\u542F\u52A8\u5BFC\u6F14\u4E0E\u751F\u4EA7\u94FE\u3002",
      status: "open",
      relatedNodeId: "short_video_director_production",
      refs: [
        {
          label: "Creative Brief",
          value: state.latestCreativeBrief.path,
          path: state.latestCreativeBrief.path
        }
      ]
    });
  }
  if (state.notebooklmAvailable && state.latestResearchBundle && state.latestCreativeBrief && !state.latestNotebookEnhancedBrief) {
    items.push({
      id: "short-video:notebooklm",
      priority: "p2",
      title: "NotebookLM \u589E\u5F3A\u5F52\u7EB3",
      reason: "\u8D26\u53F7\u7814\u7A76\u548C\u539F\u59CB creative brief \u5DF2\u5B8C\u6210\uFF0C\u4F46\u8FD8\u6CA1\u6709\u751F\u6210 NotebookLM \u589E\u5F3A\u7248 brief\u3002",
      nextAction: "\u8FD0\u884C NotebookLM \u589E\u5F3A\u5F52\u7EB3\uFF0C\u5148\u8865\u4E00\u7248\u66F4\u5F3A\u7684\u521B\u4F5C\u5EFA\u8BAE\u518D\u51B3\u5B9A\u662F\u5426\u8FDB\u5165\u5BFC\u6F14\u751F\u4EA7\u94FE\u3002",
      status: "open",
      relatedNodeId: "notebooklm_account_enhance",
      refs: [
        {
          label: "Research Bundle",
          value: state.latestResearchBundle.path,
          path: state.latestResearchBundle.path
        },
        {
          label: "Creative Brief",
          value: state.latestCreativeBrief.path,
          path: state.latestCreativeBrief.path
        }
      ]
    });
  }
  if (!state.geminiConsentGranted) {
    items.push({
      id: "short-video:gemini-consent",
      priority: "p3",
      title: "Gemini \u589E\u5F3A\u5206\u6790\u5F85\u786E\u8BA4",
      reason: "Gemini Web consent \u5C1A\u672A\u5B8C\u6210\uFF0C\u5173\u952E\u5E27\u589E\u5F3A\u5206\u6790\u8FD8\u672A\u7EB3\u5165\u6B63\u5F0F\u94FE\u8DEF\u3002",
      nextAction: "\u9700\u8981\u65F6\u5148\u5B8C\u6210 consent\uFF0C\u518D\u628A Gemini \u589E\u5F3A\u5206\u6790\u5E76\u5165\u8D26\u53F7\u7814\u7A76\u3002",
      status: "watch",
      evidenceLevel: "declared",
      relatedNodeId: "short_video_factory"
    });
  }
  return items;
}
function buildTaskDecisionQueue() {
  const assetRoot = buildAssetRootState();
  const shortVideoFactory = buildShortVideoFactoryState();
  const decisionState = readDecisionState();
  const mergedTasks = [
    ...readTaskHistory(),
    ...commandQueue.map((task) => normalizeTask(task))
  ].filter((task, index, list) => list.findIndex((item) => item.id === task.id) === index);
  const latestByNode = /* @__PURE__ */ new Map();
  for (const task of mergedTasks) {
    const existing = latestByNode.get(task.nodeId);
    if (!existing || task.updatedAt > existing.updatedAt) {
      latestByNode.set(task.nodeId, task);
    }
  }
  const failureWindowMs = 1e3 * 60 * 60 * 24;
  const decisions = [];
  if (!assetRoot.configured) {
    decisions.push({
      id: "asset-root:global",
      priority: "p1",
      title: "Asset Root Needed",
      reason: "The primary external asset root is still using the suggested default and has not been explicitly confirmed.",
      nextAction: "Adopt the suggested asset root before routing new long-term assets outside the workspace.",
      status: "open",
      refs: [
        {
          label: "Suggested Root",
          value: assetRoot.suggestedPath,
          path: assetRoot.suggestedPath
        }
      ]
    });
  }
  for (const task of latestByNode.values()) {
    const targetDir = taskTargetDir(task);
    const confirmedKnowledge = latestConfirmedKnowledgeForNode(task.nodeId);
    const failedCount = mergedTasks.filter(
      (item) => item.nodeId === task.nodeId && item.status === "failed" && now() - item.updatedAt <= failureWindowMs
    ).length;
    const queuedIndexFollowUp = task.nodeId === "project_file_organize" && commandQueue.some(
      (item) => item.nodeId === "project_file_index" && taskTargetDir(item) === targetDir && (item.status === "queued" || item.status === "claimed" || item.status === "running")
    );
    const rawDecisions = deriveDecisionQueue(
      {
        id: task.id,
        title: task.nodeLabel,
        blocked: task.status === "failed" || Boolean(task.blocker),
        blockReason: task.blocker?.summary ?? task.resultSummary,
        assetState: task.executionMode === "asset-organize" || task.executionMode === "asset-index" ? {
          configured: assetRoot.configured || Boolean(targetDir && isPathInsideLegacyRoots(targetDir)),
          path: targetDir ?? assetRoot.path
        } : void 0,
        evidence: task.status === "completed" ? {
          lastCapturedAt: new Date(task.updatedAt).toISOString(),
          lastConfirmedAt: confirmedKnowledge?.updatedAt,
          needsRefresh: !confirmedKnowledge,
          summary: confirmedKnowledge ? "Confirmed evidence exists for this workflow." : "Only declared/runtime evidence exists so far."
        } : void 0,
        failureCluster: failedCount >= 3 ? {
          id: task.nodeId,
          count: failedCount,
          latestError: task.resultSummary,
          windowMinutes: 24 * 60
        } : void 0,
        followUp: queuedIndexFollowUp ? {
          queued: true,
          reason: "Archive finished and the matching indexing step is already queued.",
          owner: "resident-agent",
          eta: "after current queue clears"
        } : void 0
      },
      {
        asset: {
          configured: assetRoot.configured,
          path: assetRoot.path
        },
        evidence: task.status === "completed" ? {
          lastCapturedAt: new Date(task.updatedAt).toISOString(),
          lastConfirmedAt: confirmedKnowledge?.updatedAt,
          needsRefresh: !confirmedKnowledge
        } : void 0
      }
    );
    for (const decision of rawDecisions) {
      decisions.push({
        id: decision.id,
        priority: normalizeDecisionPriority(decision.priority),
        title: decisionTitleFromId(decision.id),
        reason: decision.reason,
        nextAction: decision.nextAction,
        status: decision.id.startsWith("follow-up:") ? "watch" : "open",
        evidenceLevel: confirmedKnowledge ? "confirmed" : task.evidenceLevel,
        relatedTaskId: task.id,
        relatedNodeId: task.nodeId,
        refs: [
          ...targetDir ? [
            {
              label: "Target Dir",
              value: targetDir,
              path: targetDir
            }
          ] : [],
          {
            label: "Task",
            value: task.id
          }
        ]
      });
    }
  }
  const seen = /* @__PURE__ */ new Set();
  return [...decisions, ...buildShortVideoDecisions(shortVideoFactory)].filter((item) => {
    const persisted = decisionState[item.id];
    if (persisted) {
      if (persisted.status === "ignored" || persisted.status === "resolved") {
        return false;
      }
      if (persisted.status === "snoozed" && persisted.snoozeUntil) {
        const until = Date.parse(persisted.snoozeUntil);
        if (Number.isFinite(until) && until > Date.now()) {
          return false;
        }
      }
    }
    const key = `${item.title}:${item.reason}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).sort((a, b) => {
    const order = { p0: 0, p1: 1, p2: 2, p3: 3 };
    return order[a.priority] - order[b.priority];
  }).slice(0, 10);
}
function buildControlPlaneState() {
  return {
    assetRoot: buildAssetRootState(),
    decisionQueue: buildTaskDecisionQueue(),
    shortVideoFactory: buildShortVideoFactoryState()
  };
}
function broadcast(clients, event) {
  const payload = `data: ${JSON.stringify(event)}

`;
  clients.forEach((client) => client.write(payload));
}
function refreshAgentStatus() {
  if (!agentState.lastSeenAt) {
    agentState = { ...agentState, online: false };
    return;
  }
  agentState = {
    ...agentState,
    online: now() - agentState.lastSeenAt <= AGENT_OFFLINE_TIMEOUT_MS
  };
}
function recycleStaleClaims() {
  const recycleBefore = now() - TASK_CLAIM_TIMEOUT_MS;
  commandQueue.forEach((task) => {
    if (task.status === "claimed" && task.updatedAt < recycleBefore) {
      task.status = "queued";
      task.updatedAt = now();
      task.agentId = null;
      task.resultSummary = "Task claim timed out and was re-queued.";
    }
  });
}
function buildHeartbeatPayload() {
  refreshAgentStatus();
  recycleStaleClaims();
  const activeTasks = commandQueue.filter(
    (task) => task.status === "claimed" || task.status === "running"
  ).map((task) => normalizeTask(task));
  const queuedTasks = commandQueue.filter((task) => task.status === "queued").map((task) => normalizeTask(task));
  const recentTasks = [...commandQueue].filter(
    (task) => task.status === "completed" || task.status === "failed"
  ).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_RECENT_TASKS).map((task) => normalizeTask(task));
  return {
    status: agentState.online ? "alive" : "waiting-for-agent",
    timestamp: now(),
    agent: agentState,
    activeTasks,
    queuedTasks,
    recentTasks,
    decisionQueue: buildTaskDecisionQueue()
  };
}
function emitHeartbeat(clients) {
  broadcast(clients, {
    type: "heartbeat",
    payload: buildHeartbeatPayload()
  });
}
function upsertKnowledge(item) {
  const index = runtimeKnowledgeDb.findIndex((entry) => entry.id === item.id);
  if (index >= 0) {
    runtimeKnowledgeDb[index] = item;
    return;
  }
  runtimeKnowledgeDb.unshift(item);
}
function deleteKnowledge(id) {
  const index = runtimeKnowledgeDb.findIndex((entry) => entry.id === id);
  if (index >= 0) {
    runtimeKnowledgeDb.splice(index, 1);
  }
}
function getKnowledgeDb() {
  const workspaceItems = buildWorkspaceKnowledgeItems();
  const seen = /* @__PURE__ */ new Set();
  return [...runtimeKnowledgeDb, ...workspaceItems].filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}
function knowledgeEvidenceRank(item) {
  if (item.evidenceLevel === "confirmed") {
    return 0;
  }
  if (item.evidenceLevel === "runtime") {
    return 1;
  }
  return 2;
}
function knowledgeSourceRank(item) {
  if (item.sourceKind === "runtime") {
    return 0;
  }
  if (item.sourceKind === "feedback") {
    return 1;
  }
  if (item.sourceKind === "reference") {
    return 2;
  }
  return 3;
}
function searchKnowledge(query, domain, platform) {
  const normalizedQuery = (query ?? "").trim();
  return getKnowledgeDb().filter((item) => {
    const matchQuery = normalizedQuery ? item.human.title.includes(normalizedQuery) || item.human.summary.includes(normalizedQuery) || item.human.content_md.includes(normalizedQuery) || item.human.tags.some((tag) => tag.includes(normalizedQuery)) || (item.human.links ?? []).some(
      (link) => link.title.includes(normalizedQuery) || link.url.includes(normalizedQuery)
    ) || (item.human.examples ?? []).some(
      (example) => example.title.includes(normalizedQuery) || example.summary.includes(normalizedQuery)
    ) || item.machine.steps.some((step) => step.includes(normalizedQuery)) || item.machine.commands.some(
      (command) => command.includes(normalizedQuery)
    ) : true;
    const matchDomain = domain ? item.human.domain === domain : true;
    const matchPlatform = platform ? item.human.platform === platform : true;
    return matchQuery && matchDomain && matchPlatform;
  }).sort((a, b) => {
    const exactA = a.human.title.toLowerCase() === normalizedQuery.toLowerCase() ? 0 : 1;
    const exactB = b.human.title.toLowerCase() === normalizedQuery.toLowerCase() ? 0 : 1;
    if (exactA !== exactB) {
      return exactA - exactB;
    }
    const evidenceDelta = knowledgeEvidenceRank(a) - knowledgeEvidenceRank(b);
    if (evidenceDelta !== 0) {
      return evidenceDelta;
    }
    return knowledgeSourceRank(a) - knowledgeSourceRank(b);
  });
}
function qmdResultToKnowledgeItem(result, collection) {
  const ref = result.file ?? "";
  return {
    id: `kb-qmd-${collection}-${(result.docid ?? ref).replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`,
    evidenceLevel: "declared",
    knowledgeType: "qmd-result",
    sourceKind: "index",
    human: {
      title: result.title || ref || "QMD Result",
      summary: result.snippet || "Indexed by qmd",
      content_md: result.snippet || "",
      tags: ["qmd", collection],
      domain: "QMD",
      platform: collection,
      links: ref ? [{ title: result.title || ref, url: `/api/v1/qmd-doc?ref=${encodeURIComponent(ref)}` }] : []
    },
    machine: {
      intent: "qmd_search_result",
      entities: { ref, docid: result.docid, score: result.score },
      steps: [],
      commands: [],
      constraints: []
    }
  };
}
function searchQmdCollection(query, collection) {
  const process2 = spawnSync(
    "qmd",
    ["search", query, "-c", collection, "--json"],
    {
      encoding: "utf-8",
      timeout: 15e3
    }
  );
  if (process2.status !== 0 || !process2.stdout.trim()) {
    return [];
  }
  try {
    const items = JSON.parse(process2.stdout);
    return items.slice(0, 8).map((item) => qmdResultToKnowledgeItem(item, collection));
  } catch {
    return [];
  }
}
function searchQmdKnowledge(query) {
  const normalizedQuery = (query ?? "").trim();
  if (!normalizedQuery) {
    return [];
  }
  return [
    ...searchQmdCollection(normalizedQuery, "agents-knowledge"),
    ...searchQmdCollection(normalizedQuery, "content-knowledge")
  ];
}
function createTask(nodeId, command, context) {
  const timestamp = now();
  const skillTreeNodes = getSkillTreeNodes();
  const nodeLabelById = new Map(
    skillTreeNodes.map((node) => [node.id, node.label])
  );
  const fallbackLabel = shortVideoNodeLabels[nodeId];
  const executionMode = inferExecutionMode(nodeId, command);
  return {
    id: `task_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
    nodeId,
    nodeLabel: nodeLabelById.get(nodeId) ?? fallbackLabel ?? nodeId,
    familyId: taskFamilyId(nodeId),
    familyLabel: nodeLabelById.get(nodeId) ?? fallbackLabel ?? nodeId,
    command,
    executionMode,
    status: "queued",
    stage: "queued",
    evidenceLevel: "declared",
    decisionState: {
      status: "watch",
      priority: executionMode === "asset-organize" || executionMode === "asset-index" ? "p2" : "p3",
      reason: executionMode === "asset-organize" || executionMode === "asset-index" ? "Asset intake task queued and waiting for resident execution." : "Task queued and waiting for execution.",
      nextAction: "Wait for the resident agent to claim the task."
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    agentId: null,
    context
  };
}
function getSkillTreeNodes() {
  const loadedNodes = loadSkillTreeNodes();
  return loadedNodes.length > 0 ? loadedNodes : mockSkillNodes;
}
function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function renderInlineMarkdown(text) {
  return escapeHtml(text).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
function renderMarkdownDocument(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let inCode = false;
  let codeLines = [];
  let listItems = [];
  let paragraph = [];
  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };
  const flushCode = () => {
    if (!inCode) return;
    blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    codeLines = [];
    inCode = false;
  };
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      if (inCode) {
        flushCode();
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(6, heading[1].length);
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const listItem = line.match(/^[-*]\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      listItems.push(listItem[1]);
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  flushCode();
  return blocks.join("\n");
}
function humanReadableTmpDir() {
  return path7.join(os3.tmpdir(), "mission-control-human-readable");
}
function buildHumanReadableArtifact(pathValue) {
  const pythonProcess = spawnSync(
    "python3",
    [path7.join(process.cwd(), "scripts", "render_human_readable_artifact.py"), "--path", pathValue],
    {
      cwd: process.cwd(),
      encoding: "utf-8",
      timeout: 2e4
    }
  );
  if (pythonProcess.status !== 0) {
    throw new Error(
      pythonProcess.stderr?.trim() || pythonProcess.stdout?.trim() || "Failed to render human artifact"
    );
  }
  return JSON.parse(pythonProcess.stdout);
}
function buildHumanReadableDocx(pathValue) {
  const payload = buildHumanReadableArtifact(pathValue);
  const tempDir = humanReadableTmpDir();
  ensureDir(tempDir);
  const hash = crypto2.createHash("sha1").update(pathValue).digest("hex").slice(0, 12);
  const htmlPath = path7.join(tempDir, `${hash}.html`);
  const docxPath = path7.join(tempDir, `${hash}.docx`);
  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(payload.title)}</title>
    <style>
      body { font: 15px/1.7 -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; color: #12151d; padding: 40px; }
      h1, h2, h3 { color: #12151d; }
      pre { white-space: pre-wrap; word-break: break-word; font: 13px/1.6 Menlo, monospace; }
      code { font: 13px/1.5 Menlo, monospace; }
    </style>
  </head>
  <body>${renderMarkdownDocument(payload.content_md)}</body>
</html>`;
  fs7.writeFileSync(htmlPath, html, "utf-8");
  const conversion = spawnSync(
    "textutil",
    ["-convert", "docx", htmlPath, "-output", docxPath],
    {
      encoding: "utf-8",
      timeout: 2e4
    }
  );
  if (conversion.status !== 0 || !fs7.existsSync(docxPath)) {
    throw new Error(conversion.stderr?.trim() || conversion.stdout?.trim() || "Failed to generate Word document");
  }
  return {
    ...payload,
    docxPath
  };
}
function isAllowedDocPath(targetPath) {
  const resolved = path7.resolve(targetPath);
  return docRoots.some((root) => resolved.startsWith(path7.resolve(root)));
}
function isAllowedFileActionPath(targetPath) {
  const resolved = path7.resolve(targetPath);
  return fileActionRoots.some((root) => resolved.startsWith(path7.resolve(root)));
}
function isAllowedCloudPackagePath(targetPath) {
  const resolved = path7.resolve(targetPath);
  const cloudRoots = [
    cloudOfficialPackageRoot,
    path7.join(cloudOfficialPackageRoot, "packages")
  ];
  return cloudRoots.some((root) => resolved.startsWith(path7.resolve(root)));
}
function ensureDir(targetPath) {
  fs7.mkdirSync(targetPath, { recursive: true });
}
function stageCommunityPackageUpload(fileName, contentBase64) {
  ensureDir(localPackageStagingRoot);
  const safeName = path7.basename(fileName || "community-package.zip");
  const stagedPath = path7.join(
    localPackageStagingRoot,
    `${Date.now()}-${safeName}`
  );
  fs7.writeFileSync(stagedPath, Buffer.from(contentBase64, "base64"));
  return stagedPath;
}
function runLocalPackageRegistry(args) {
  const result = spawnSync("python3", [localPackageRegistryScript, ...args], {
    cwd: process.cwd(),
    encoding: "utf-8",
    timeout: 12e4
  });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || "Local package registry command failed");
  }
  return JSON.parse(result.stdout);
}
function runQmdUpdateSync() {
  const process2 = spawnSync("qmd", ["update"], {
    cwd: workspaceRoot3,
    encoding: "utf-8",
    timeout: 2e4
  });
  if (process2.status !== 0) {
    return process2.stderr?.trim() || process2.stdout?.trim() || "qmd update failed";
  }
  return process2.stdout?.trim() || "qmd update completed";
}
function bootstrapAppDevSession() {
  if (process.env.OPENCLAW_DISABLE_APP_DEV_SESSION === "1" || process.env.NODE_ENV === "production") {
    return;
  }
  if (appDevSessionBootstrapped) {
    return;
  }
  appDevSessionBootstrapped = true;
  const message = "\u63A5\u7BA1 SoloCore Console \u7684\u957F\u671F\u5F00\u53D1\u4E0E\u7EF4\u62A4\u3002\u5148\u8BFB\u53D6 ~/.openclaw/workspace/apps/mission-control/OPENCLAW_INSTRUCTIONS.md\u3001USER_MANUAL.md\u3001AGENTS.md\u3001agent-routing.config.json\u3002\u4F60\u7684\u89D2\u8272\u662F\u4E3B\u7F16\u6392\u8005\uFF0C\u4E0D\u662F\u5355\u4E00\u5DE5\u7A0B\u5E08\u3002\u6301\u7EED\u5904\u7406\u8FD9\u4E2A\u5E94\u7528\u7684\u53CD\u9988\u3001\u81EA\u8FDB\u5316\u4EFB\u52A1\u3001UI \u6539\u8FDB\u3001SOP \u6267\u884C\u94FE\u4FEE\u590D\uFF0C\u5E76\u628A\u4EFB\u52A1\u5206\u914D\u7ED9\u6700\u5408\u9002\u7684 agents\u3002";
  const child = spawn(
    "openclaw",
    [
      "agent",
      "--agent",
      "main",
      "--session-id",
      APP_DEV_SESSION_ID,
      "--message",
      message,
      "--json",
      "--timeout",
      "120"
    ],
    {
      detached: true,
      stdio: "ignore"
    }
  );
  child.unref();
}
function feedbackSuggestions(feedback, task, sentiment) {
  const normalized = feedback.toLowerCase();
  const suggestions = [];
  if (sentiment === "negative") {
    suggestions.push("Re-check the SOP defaults and required input schema before the next run.");
    suggestions.push("Update the workflow output contract so the final artifact is easier to inspect.");
  }
  if (normalized.includes("\u5217") || normalized.includes("\u5B57\u6BB5") || normalized.includes("column")) {
    suggestions.push("Adjust the exported schema or column mapping for this SOP.");
  }
  if (normalized.includes("\u8DEF\u5F84") || normalized.includes("\u76EE\u5F55") || normalized.includes("path")) {
    suggestions.push("Refine default output path and artifact reveal behavior.");
  }
  if (normalized.includes("\u6458\u8981") || normalized.includes("\u603B\u89C8") || normalized.includes("summary")) {
    suggestions.push("Add or improve a summary block in the final artifact or dashboard preview.");
  }
  if (normalized.includes("\u9ED8\u8BA4") || normalized.includes("default")) {
    suggestions.push("Revisit the default behavior for this SOP so it matches the user's preferred delivery flow.");
  }
  if (normalized.includes("\u683C\u5F0F") || normalized.includes("style") || normalized.includes("excel")) {
    suggestions.push("Tune the final writer or formatter for this artifact type.");
  }
  if (normalized.includes("\u4E0D\u5BF9") || normalized.includes("\u9519\u8BEF") || normalized.includes("wrong")) {
    suggestions.push("Add a runtime validation checkpoint before marking the task completed.");
  }
  if (sentiment === "positive" && suggestions.length === 0 && (normalized.includes("\u5F88\u597D") || normalized.includes("\u6EE1\u610F") || normalized.includes("good"))) {
    suggestions.push("Promote this run as a confirmed reference case in the knowledge base.");
  }
  if (suggestions.length === 0) {
    suggestions.push("Record this feedback as a reusable rule for future runs of the same SOP.");
  }
  suggestions.push(`Keep feedback linked to node ${task.nodeId} so future retrieval can match this SOP.`);
  return [...new Set(suggestions)];
}
function renderConsoleAccessRequiredHtml() {
  const hubUrl = process.env.OPENCLAW_WEB_BASE_URL || process.env.SOLOCORE_HUB_BASE_URL || "";
  const href = hubUrl ? `${hubUrl.replace(/\/+$/, "")}/cloud-console` : "/cloud-console";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SoloCore Console Access Required</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0a0e17; color: #e2e8f0; font: 16px/1.6 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
      .card { width: min(560px, calc(100vw - 32px)); background: rgba(15, 23, 42, 0.96); border: 1px solid rgba(51, 65, 85, 0.8); border-radius: 24px; padding: 32px; box-shadow: 0 24px 80px rgba(15, 23, 42, 0.4); }
      h1 { margin: 0 0 12px; font-size: 28px; }
      p { margin: 0 0 14px; color: #94a3b8; }
      a { display: inline-flex; margin-top: 8px; padding: 12px 18px; border-radius: 999px; background: #2563eb; color: white; text-decoration: none; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Access Required</h1>
      <p>This SoloCore Console is deployed as a separate cloud app and only accepts Hub-issued access grants.</p>
      <p>Return to SoloCore Hub, redeem your authorization code, and launch the Console again from there.</p>
      <a href="${escapeHtml(href)}">Open SoloCore Hub Access Page</a>
    </div>
  </body>
</html>`;
}
async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
  const host = process.env.HOST || process.env.OPENCLAW_BIND_HOST || (process.env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0");
  app.use(express.json({ limit: "50mb" }));
  app.get("/auth/access", (req, res) => {
    if (!cloudConsoleAccessEnabled()) {
      return res.redirect("/");
    }
    const grant = typeof req.query.grant === "string" ? req.query.grant.trim() : "";
    const redirectTo = typeof req.query.redirectTo === "string" ? req.query.redirectTo : "/";
    const claims = acceptConsoleGrant(grant);
    if (!claims) {
      res.status(401).setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(renderConsoleAccessRequiredHtml());
      return;
    }
    setConsoleSessionCookie(res, claims);
    res.redirect(redirectTo.startsWith("/") ? redirectTo : "/");
  });
  app.get("/auth/session", (req, res) => {
    const session = readConsoleSession(req);
    if (!session) {
      return res.json({
        authenticated: false,
        user: null
      });
    }
    return res.json({
      authenticated: true,
      user: {
        id: session.sub,
        email: session.email,
        role: session.role
      },
      expiresAt: new Date(session.exp * 1e3).toISOString()
    });
  });
  app.post("/auth/logout", (_req, res) => {
    clearConsoleSessionCookie(res);
    res.json({ success: true });
  });
  app.use((req, res, next) => {
    if (!cloudConsoleAccessEnabled()) {
      next();
      return;
    }
    if (req.path === "/auth/access" || req.path === "/auth/session" || req.path === "/auth/logout") {
      next();
      return;
    }
    if (requestHasInternalConsoleAccess(req)) {
      next();
      return;
    }
    const session = readConsoleSession(req);
    if (session) {
      req.cloudConsoleSession = session;
      next();
      return;
    }
    if (req.path.startsWith("/api/")) {
      res.status(401).json({ error: "Cloud console access required" });
      return;
    }
    res.status(401).setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderConsoleAccessRequiredHtml());
  });
  app.use("/exports", express.static(path7.join(process.cwd(), "exports")));
  let clients = [];
  const queueShortVideoTask = (nodeId, command, inputValues) => {
    const task = createTask(nodeId, command, {
      inputValues,
      sourcePath: path7.join(process.cwd(), "scripts"),
      sourceType: "content-system",
      requiredSkills: [],
      assetRootPath: buildAssetRootState().path
    });
    commandQueue.push(task);
    persistTask(task);
    broadcast(clients, {
      type: "task-queued",
      payload: task
    });
    emitHeartbeat(clients);
    return task;
  };
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      heartbeat: buildHeartbeatPayload()
    });
  });
  app.get("/api/v1/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    clients.push(res);
    broadcast([res], { type: "connected" });
    emitHeartbeat([res]);
    req.on("close", () => {
      clients = clients.filter((client) => client !== res);
    });
  });
  setInterval(() => {
    emitHeartbeat(clients);
    if (residentAgentStartGracePassed) {
      ensureResidentAgent();
    }
  }, HEARTBEAT_INTERVAL_MS);
  app.get("/api/v1/stream-vibe", (_req, res) => {
    res.redirect(307, "/api/v1/stream");
  });
  app.get("/api/v1/skill-tree", (_req, res) => {
    res.json({
      nodes: getSkillTreeNodes(),
      source: "openclaw-workspace"
    });
  });
  app.get("/api/v1/doc", (req, res) => {
    const rawPath = typeof req.query.path === "string" ? req.query.path.trim() : "";
    if (!rawPath) {
      return res.status(400).send("Missing path");
    }
    if (!isAllowedDocPath(rawPath)) {
      return res.status(403).send("Path not allowed");
    }
    if (!fs7.existsSync(rawPath) || !fs7.statSync(rawPath).isFile()) {
      return res.status(404).send("Document not found");
    }
    const content = fs7.readFileSync(rawPath, "utf-8");
    const title = path7.basename(rawPath);
    const isMarkdown = rawPath.toLowerCase().endsWith(".md");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { margin: 0; background: #f6f7fb; color: #12151d; font: 16px/1.65 -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif; }
      .shell { max-width: 960px; margin: 0 auto; padding: 32px 20px 80px; }
      .meta { margin-bottom: 18px; color: #667085; font-size: 13px; }
      .card { background: white; border: 1px solid #e4e7ec; border-radius: 20px; padding: 28px; box-shadow: 0 18px 48px rgba(16,24,40,0.08); }
      .doc { font: 16px/1.75 -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif; color: #12151d; }
      .doc h1, .doc h2, .doc h3 { line-height: 1.25; margin: 1.2em 0 0.55em; }
      .doc h1 { font-size: 1.9rem; margin-top: 0; }
      .doc h2 { font-size: 1.35rem; }
      .doc h3 { font-size: 1.05rem; }
      .doc p { margin: 0.8em 0; }
      .doc ul { padding-left: 1.25rem; margin: 0.8em 0; }
      .doc li { margin: 0.35em 0; }
      .doc pre { white-space: pre-wrap; word-break: break-word; font: 14px/1.7 "JetBrains Mono", ui-monospace, monospace; margin: 1em 0; background: #f5f7fb; border: 1px solid #e4e7ec; border-radius: 14px; padding: 14px; overflow: auto; }
      .doc code { font: 13px/1.5 "JetBrains Mono", ui-monospace, monospace; background: #f5f7fb; border-radius: 6px; padding: 0.12em 0.35em; }
      a { color: #1463ff; }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="meta">${escapeHtml(rawPath)}</div>
      <div class="card"><div class="doc">${isMarkdown ? renderMarkdownDocument(content) : `<pre>${escapeHtml(content)}</pre>`}</div></div>
    </div>
  </body>
</html>`);
  });
  app.get("/api/v1/artifact/human", (req, res) => {
    const rawPath = typeof req.query.path === "string" ? req.query.path.trim() : "";
    if (!rawPath) {
      return res.status(400).send("Missing path");
    }
    if (!isAllowedDocPath(rawPath) && !isAllowedFileActionPath(rawPath)) {
      return res.status(403).send("Path not allowed");
    }
    if (!fs7.existsSync(rawPath)) {
      return res.status(404).send("Artifact not found");
    }
    try {
      const artifact = buildHumanReadableArtifact(rawPath);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(artifact.title)} \xB7 SoloCore Console</title>
    <style>
      body { margin: 0; background: #f6f7fb; color: #12151d; font: 16px/1.65 -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif; }
      .shell { max-width: 980px; margin: 0 auto; padding: 32px 20px 80px; }
      .meta { margin-bottom: 18px; color: #667085; font-size: 13px; }
      .card { background: white; border: 1px solid #e4e7ec; border-radius: 20px; padding: 28px; box-shadow: 0 18px 48px rgba(16,24,40,0.08); }
      .toolbar { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
      .toolbar a, .toolbar button { border: 1px solid #d0d5dd; border-radius: 999px; padding: 10px 14px; background: white; color: #101828; text-decoration: none; font: 600 12px/1 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; cursor: pointer; }
      .toolbar button.primary, .toolbar a.primary { background: #e8f1ff; border-color: #b7cdf7; }
      .doc h1, .doc h2, .doc h3 { line-height: 1.25; margin: 1.2em 0 0.55em; }
      .doc h1 { font-size: 1.9rem; margin-top: 0; }
      .doc h2 { font-size: 1.35rem; }
      .doc h3 { font-size: 1.05rem; }
      .doc p { margin: 0.8em 0; }
      .doc ul { padding-left: 1.25rem; margin: 0.8em 0; }
      .doc li { margin: 0.35em 0; }
      .doc pre { white-space: pre-wrap; word-break: break-word; font: 14px/1.7 "JetBrains Mono", ui-monospace, monospace; margin: 1em 0; background: #f5f7fb; border: 1px solid #e4e7ec; border-radius: 14px; padding: 14px; overflow: auto; }
      .doc code { font: 13px/1.5 "JetBrains Mono", ui-monospace, monospace; background: #f5f7fb; border-radius: 6px; padding: 0.12em 0.35em; }
      .source { margin-top: 20px; font-size: 12px; color: #667085; word-break: break-all; }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="toolbar">
        <a class="primary" href="/api/v1/artifact/human/download-docx?path=${encodeURIComponent(rawPath)}">\u4E0B\u8F7D Word</a>
        <a href="/api/v1/doc?path=${encodeURIComponent(rawPath)}">\u67E5\u770B\u539F\u59CB\u8BB0\u5F55</a>
      </div>
      <div class="meta">${escapeHtml(artifact.kind)}</div>
      <div class="card"><div class="doc">${renderMarkdownDocument(artifact.content_md)}</div></div>
      <div class="source">\u539F\u59CB\u8DEF\u5F84\uFF1A${escapeHtml(rawPath)}</div>
    </div>
  </body>
</html>`);
    } catch (error) {
      return res.status(500).send(error instanceof Error ? error.message : "Failed to render artifact");
    }
  });
  app.get("/api/v1/artifact/human/download-docx", (req, res) => {
    const rawPath = typeof req.query.path === "string" ? req.query.path.trim() : "";
    if (!rawPath) {
      return res.status(400).send("Missing path");
    }
    if (!isAllowedDocPath(rawPath) && !isAllowedFileActionPath(rawPath)) {
      return res.status(403).send("Path not allowed");
    }
    if (!fs7.existsSync(rawPath)) {
      return res.status(404).send("Artifact not found");
    }
    try {
      const docx = buildHumanReadableDocx(rawPath);
      res.download(docx.docxPath, docx.suggested_filename);
    } catch (error) {
      return res.status(500).send(error instanceof Error ? error.message : "Failed to build Word download");
    }
  });
  app.get("/api/v1/qmd-doc", (req, res) => {
    const ref = typeof req.query.ref === "string" ? req.query.ref.trim() : "";
    if (!ref) {
      return res.status(400).send("Missing ref");
    }
    const process2 = spawnSync("qmd", ["get", ref], {
      encoding: "utf-8",
      timeout: 15e3
    });
    if (process2.status !== 0) {
      return res.status(404).send("QMD document not found");
    }
    const content = process2.stdout || process2.stderr || "";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(ref)}</title>
    <style>
      body { margin: 0; background: #f6f7fb; color: #12151d; font: 16px/1.65 -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif; }
      .shell { max-width: 960px; margin: 0 auto; padding: 32px 20px 80px; }
      .meta { margin-bottom: 18px; color: #667085; font-size: 13px; }
      .card { background: white; border: 1px solid #e4e7ec; border-radius: 20px; padding: 28px; box-shadow: 0 18px 48px rgba(16,24,40,0.08); }
      pre { white-space: pre-wrap; word-break: break-word; font: 14px/1.7 "JetBrains Mono", ui-monospace, monospace; margin: 0; }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="meta">${escapeHtml(ref)}</div>
      <div class="card"><pre>${escapeHtml(content)}</pre></div>
    </div>
  </body>
</html>`);
  });
  app.post("/api/v1/file/open", (req, res) => {
    const targetPath = typeof req.body?.path === "string" ? req.body.path.trim() : "";
    const reveal = Boolean(req.body?.reveal);
    if (!targetPath) {
      return res.status(400).json({ error: "path is required" });
    }
    if (!isAllowedFileActionPath(targetPath)) {
      return res.status(403).json({ error: "Path not allowed" });
    }
    if (!fs7.existsSync(targetPath)) {
      return res.status(404).json({ error: "File not found" });
    }
    const args = reveal && fs7.statSync(targetPath).isFile() ? ["-R", targetPath] : [targetPath];
    const process2 = spawnSync("open", args, {
      encoding: "utf-8",
      timeout: 1e4
    });
    if (process2.status !== 0) {
      return res.status(500).json({
        error: process2.stderr?.trim() || process2.stdout?.trim() || "Failed to open file"
      });
    }
    return res.json({ success: true });
  });
  app.post("/api/v1/control-plane/decision-action", (req, res) => {
    const decisionId = typeof req.body?.decisionId === "string" ? req.body.decisionId.trim() : "";
    const action = typeof req.body?.action === "string" ? req.body.action.trim() : "";
    const relatedTaskId = typeof req.body?.relatedTaskId === "string" ? req.body.relatedTaskId.trim() : "";
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
    if (!decisionId || !action) {
      return res.status(400).json({ error: "decisionId and action are required" });
    }
    if (action === "ignore") {
      setDecisionState(decisionId, {
        status: "ignored",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        note
      });
      emitHeartbeat(clients);
      return res.json({ success: true });
    }
    if (action === "resolve") {
      setDecisionState(decisionId, {
        status: "resolved",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        note
      });
      emitHeartbeat(clients);
      return res.json({ success: true });
    }
    if (action === "snooze") {
      const snoozeUntil = new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString();
      setDecisionState(decisionId, {
        status: "snoozed",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        snoozeUntil,
        note
      });
      emitHeartbeat(clients);
      return res.json({ success: true, snoozeUntil });
    }
    if (action === "retry-task") {
      if (!relatedTaskId) {
        return res.status(400).json({ error: "relatedTaskId is required for retry-task" });
      }
      const task = findTaskById(relatedTaskId);
      if (!task) {
        return res.status(404).json({ error: "Related task not found" });
      }
      const queuedTask = queueClonedTask(task);
      setDecisionState(decisionId, {
        status: "resolved",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        note: note || "retry queued"
      });
      broadcast(clients, {
        type: "task-queued",
        payload: queuedTask
      });
      emitHeartbeat(clients);
      return res.json({ success: true, task: queuedTask });
    }
    return res.status(400).json({ error: `Unsupported action: ${action}` });
  });
  app.post("/api/v1/storage-retrieval/search", (req, res) => {
    const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
    const scope = typeof req.body?.scope === "string" ? req.body.scope.trim() : "all";
    const type = typeof req.body?.type === "string" ? req.body.type.trim() : "all";
    const platform = typeof req.body?.platform === "string" ? req.body.platform.trim() : "all";
    const projectSeries = typeof req.body?.projectSeries === "string" ? req.body.projectSeries.trim() : "";
    if (!query) {
      return res.json({ assets: [], knowledge: [] });
    }
    const assets = scope === "knowledge" ? [] : searchAssetEntries({
      query,
      type,
      platform,
      projectSeries
    });
    const knowledge = scope === "assets" ? [] : searchKnowledgeEntries({
      query,
      platform,
      projectSeries
    });
    return res.json({ assets, knowledge });
  });
  app.get("/api/v1/storage-retrieval/recent", (_req, res) => {
    return res.json({
      imports: fetchStorageImportRecent()
    });
  });
  app.post("/api/v1/storage-retrieval/import", (req, res) => {
    const pathEntries = Array.isArray(req.body?.pathEntries) ? req.body.pathEntries.map((item) => String(item).trim()).filter(Boolean) : [];
    const linkEntries = Array.isArray(req.body?.linkEntries) ? req.body.linkEntries.map((item) => String(item).trim()).filter(Boolean) : [];
    const files = Array.isArray(req.body?.files) ? req.body.files.map((item) => ({
      name: String(item?.name ?? ""),
      relativePath: String(item?.relativePath ?? item?.name ?? ""),
      contentBase64: String(item?.contentBase64 ?? "")
    })) : [];
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
    if (pathEntries.length === 0 && linkEntries.length === 0 && files.length === 0) {
      return res.status(400).json({ error: "Nothing to import" });
    }
    try {
      const result = createStorageImportRecord({
        pathEntries,
        linkEntries,
        note,
        files
      });
      return res.json(result);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to import storage items"
      });
    }
  });
  app.post("/api/v1/storage-retrieval/reclassify", (req, res) => {
    const manifestPath = typeof req.body?.manifestPath === "string" ? req.body.manifestPath.trim() : "";
    const itemIndex = Number(req.body?.itemIndex);
    const projectFolder = typeof req.body?.projectFolder === "string" ? req.body.projectFolder.trim() : "";
    const workflow = typeof req.body?.workflow === "string" ? req.body.workflow.trim() : "";
    const stage = typeof req.body?.stage === "string" ? req.body.stage.trim() : "";
    if (!manifestPath) {
      return res.status(400).json({ error: "manifestPath is required" });
    }
    if (!Number.isInteger(itemIndex) || itemIndex < 0) {
      return res.status(400).json({ error: "itemIndex is required" });
    }
    if (!projectFolder) {
      return res.status(400).json({ error: "projectFolder is required" });
    }
    try {
      const result = reclassifyStorageImportItem({
        manifestPath,
        itemIndex,
        projectFolder,
        workflow,
        stage
      });
      return res.json(result);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to reclassify import item"
      });
    }
  });
  app.get("/api/v1/local-packages", (_req, res) => {
    try {
      return res.json(runLocalPackageRegistry(["list"]));
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to list local packages"
      });
    }
  });
  app.post("/api/v1/local-packages/inspect", (req, res) => {
    try {
      let packagePath = typeof req.body?.packagePath === "string" ? req.body.packagePath.trim() : "";
      const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.trim() : "";
      const contentBase64 = typeof req.body?.contentBase64 === "string" ? req.body.contentBase64 : "";
      if (!packagePath && fileName && contentBase64) {
        packagePath = stageCommunityPackageUpload(fileName, contentBase64);
      }
      if (!packagePath) {
        return res.status(400).json({ error: "packagePath or uploaded package content is required" });
      }
      if (!contentBase64 && !isAllowedFileActionPath(packagePath)) {
        return res.status(403).json({ error: "Package path not allowed" });
      }
      return res.json(runLocalPackageRegistry(["inspect", "--package-path", path7.resolve(packagePath)]));
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to inspect local package"
      });
    }
  });
  app.post("/api/v1/local-packages/install", (req, res) => {
    try {
      const packagePath = typeof req.body?.packagePath === "string" ? req.body.packagePath.trim() : "";
      const distributionChannel = typeof req.body?.distributionChannel === "string" ? req.body.distributionChannel.trim() : "local-file";
      const releaseUrl = typeof req.body?.releaseUrl === "string" ? req.body.releaseUrl.trim() : "";
      const sourceRepo = typeof req.body?.sourceRepo === "string" ? req.body.sourceRepo.trim() : "";
      const sourceTag = typeof req.body?.sourceTag === "string" ? req.body.sourceTag.trim() : "";
      if (!packagePath) {
        return res.status(400).json({ error: "packagePath is required" });
      }
      if (!isAllowedFileActionPath(packagePath) && !isAllowedCloudPackagePath(packagePath)) {
        return res.status(403).json({ error: "Package path not allowed" });
      }
      return res.json(
        runLocalPackageRegistry([
          "install",
          "--package-path",
          path7.resolve(packagePath),
          "--distribution-channel",
          distributionChannel,
          "--release-url",
          releaseUrl,
          "--source-repo",
          sourceRepo,
          "--source-tag",
          sourceTag
        ])
      );
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to install local package"
      });
    }
  });
  app.post("/api/v1/local-packages/enable", (req, res) => {
    try {
      const packageId = typeof req.body?.packageId === "string" ? req.body.packageId.trim() : "";
      const version = typeof req.body?.version === "string" ? req.body.version.trim() : "";
      if (!packageId || !version) {
        return res.status(400).json({ error: "packageId and version are required" });
      }
      return res.json(
        runLocalPackageRegistry(["enable", "--package-id", packageId, "--version", version])
      );
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to enable local package"
      });
    }
  });
  app.post("/api/v1/local-packages/disable", (req, res) => {
    try {
      const packageId = typeof req.body?.packageId === "string" ? req.body.packageId.trim() : "";
      const version = typeof req.body?.version === "string" ? req.body.version.trim() : "";
      if (!packageId || !version) {
        return res.status(400).json({ error: "packageId and version are required" });
      }
      return res.json(
        runLocalPackageRegistry(["disable", "--package-id", packageId, "--version", version])
      );
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to disable local package"
      });
    }
  });
  app.post("/api/v1/local-packages/rollback", (req, res) => {
    try {
      const packageId = typeof req.body?.packageId === "string" ? req.body.packageId.trim() : "";
      const targetVersion = typeof req.body?.targetVersion === "string" ? req.body.targetVersion.trim() : "";
      if (!packageId) {
        return res.status(400).json({ error: "packageId is required" });
      }
      const args = ["rollback", "--package-id", packageId];
      if (targetVersion) {
        args.push("--target-version", targetVersion);
      }
      return res.json(runLocalPackageRegistry(args));
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to rollback local package"
      });
    }
  });
  app.post("/api/v1/local-packages/uninstall", (req, res) => {
    try {
      const packageId = typeof req.body?.packageId === "string" ? req.body.packageId.trim() : "";
      const version = typeof req.body?.version === "string" ? req.body.version.trim() : "";
      if (!packageId || !version) {
        return res.status(400).json({ error: "packageId and version are required" });
      }
      return res.json(
        runLocalPackageRegistry(["uninstall", "--package-id", packageId, "--version", version])
      );
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to uninstall local package"
      });
    }
  });
  app.get("/api/v1/control-plane/state", (_req, res) => {
    res.json(buildControlPlaneState());
  });
  app.post("/api/v1/control-plane/asset-root", (req, res) => {
    const nextPath = typeof req.body?.path === "string" ? req.body.path.trim() : "";
    if (!nextPath) {
      return res.status(400).json({ error: "path is required" });
    }
    const resolved = path7.resolve(nextPath);
    if (!path7.isAbsolute(resolved)) {
      return res.status(400).json({ error: "Asset root must be an absolute path" });
    }
    updateAgentOsConfig({ assetRootPath: resolved });
    return res.json({
      success: true,
      assetRoot: buildAssetRootState()
    });
  });
  app.post("/api/v1/control-plane/asset-intake", (req, res) => {
    const targetDir = typeof req.body?.targetDir === "string" ? req.body.targetDir.trim() : "";
    const archiveRule = typeof req.body?.archiveRule === "string" ? req.body.archiveRule.trim() : "";
    const action = typeof req.body?.action === "string" ? req.body.action.trim() : "full";
    if (!targetDir) {
      return res.status(400).json({ error: "targetDir is required" });
    }
    const resolvedTargetDir = path7.resolve(targetDir);
    const assetRootState = buildAssetRootState();
    const primaryConfig = readAgentOsConfig();
    const insideManagedRoots = isPathInsideLegacyRoots(resolvedTargetDir) || assetRootState.configured && isPathInsideAssetRoot(resolvedTargetDir, primaryConfig);
    if (!insideManagedRoots) {
      return res.status(400).json({
        error: "Target directory must be inside the configured asset root or a legacy mapped workspace root."
      });
    }
    const queueTask = (nodeId, command, inputValues) => {
      const task = createTask(nodeId, command, {
        inputValues,
        sourcePath: path7.join(process.cwd(), "scripts"),
        sourceType: "content-system",
        targetDir: resolvedTargetDir,
        archiveRule,
        assetRootPath: assetRootState.path,
        requiredSkills: []
      });
      commandQueue.push(task);
      persistTask(task);
      broadcast(clients, {
        type: "task-queued",
        payload: task
      });
      return task;
    };
    const queuedTasks = [];
    if (action === "organize" || action === "full") {
      queuedTasks.push(
        queueTask(
          "project_file_organize",
          `python3 ${path7.join(process.cwd(), "scripts", "run_project_file_organize.py")} --target-dir <\u76EE\u6807\u76EE\u5F55> --rule <\u5F52\u6863\u89C4\u5219\u8BF4\u660E>`,
          {
            \u76EE\u6807\u76EE\u5F55: resolvedTargetDir,
            \u5F52\u6863\u89C4\u5219\u8BF4\u660E: archiveRule
          }
        )
      );
    }
    if (action === "index" || action === "full") {
      queuedTasks.push(
        queueTask(
          "project_file_index",
          `python3 ${path7.join(process.cwd(), "scripts", "run_project_file_index.py")} --target-dir <\u76EE\u6807\u76EE\u5F55>`,
          {
            \u76EE\u6807\u76EE\u5F55: resolvedTargetDir
          }
        )
      );
    }
    emitHeartbeat(clients);
    return res.json({
      success: true,
      queuedTasks,
      decisionSummary: summarizeDecisions(deriveDecisionQueue(
        {
          id: queuedTasks[0]?.id,
          title: queuedTasks[0]?.nodeLabel,
          followUp: action === "full" ? {
            queued: true,
            reason: "Archive and index were queued together for the same directory."
          } : void 0
        },
        {
          asset: {
            configured: assetRootState.configured,
            path: assetRootState.path
          }
        }
      ))
    });
  });
  app.post("/api/v1/control-plane/short-video/sample-batch", (req, res) => {
    const platform = typeof req.body?.platform === "string" ? req.body.platform.trim() : "mixed";
    const accountName = typeof req.body?.accountName === "string" ? req.body.accountName.trim() : "";
    const accountHandle = typeof req.body?.accountHandle === "string" ? req.body.accountHandle.trim() : "";
    const objective = typeof req.body?.objective === "string" && req.body.objective.trim() ? req.body.objective.trim() : "\u5EFA\u7ACB\u5BF9\u6807\u8D26\u53F7\u6837\u672C\u6279\u6B21\u5E76\u8FDB\u5165\u77ED\u89C6\u9891\u8D44\u4EA7\u5DE5\u5382";
    const sampleSize = Number(req.body?.sampleSize ?? DEFAULT_SHORT_VIDEO_SAMPLE_SIZE);
    const targetMode = typeof req.body?.targetMode === "string" && req.body.targetMode.trim() ? req.body.targetMode.trim() : "script-first";
    const batchId = typeof req.body?.batchId === "string" && req.body.batchId.trim() ? req.body.batchId.trim() : "batch-001";
    const links = Array.isArray(req.body?.links) ? req.body.links : [];
    if (!accountName) {
      return res.status(400).json({ error: "accountName is required" });
    }
    if (links.length < DEFAULT_SHORT_VIDEO_MIN_SAMPLE_SIZE) {
      return res.status(400).json({
        error: `At least ${DEFAULT_SHORT_VIDEO_MIN_SAMPLE_SIZE} links are required`
      });
    }
    const batchProcess = spawnSync(
      "python3",
      [
        path7.join(process.cwd(), "scripts", "run_short_video_sample_batch.py"),
        "--platform",
        platform,
        "--account-name",
        accountName,
        "--account-handle",
        accountHandle,
        "--objective",
        objective,
        "--sample-size",
        String(Number.isFinite(sampleSize) ? sampleSize : DEFAULT_SHORT_VIDEO_SAMPLE_SIZE),
        "--target-mode",
        targetMode,
        "--batch-id",
        batchId,
        "--project-series",
        DEFAULT_SHORT_VIDEO_SERIES,
        "--project-instance",
        shortVideoDefaultInstance(),
        "--links-json",
        JSON.stringify(links)
      ],
      {
        cwd: process.cwd(),
        encoding: "utf-8",
        timeout: 3e4
      }
    );
    if (batchProcess.status !== 0) {
      return res.status(500).json({
        error: batchProcess.stderr?.trim() || batchProcess.stdout?.trim() || "Failed to create short-video sample batch"
      });
    }
    const payload = JSON.parse(batchProcess.stdout);
    return res.json({
      success: true,
      sampleManifest: payload.sample_manifest,
      sourceLinksCsv: payload.source_links_csv,
      executionSummary: payload.execution_summary
    });
  });
  app.post("/api/v1/control-plane/short-video/account-research", (req, res) => {
    const manifestPath = typeof req.body?.manifestPath === "string" ? path7.resolve(req.body.manifestPath.trim()) : "";
    const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
    if (!manifestPath) {
      return res.status(400).json({ error: "manifestPath is required" });
    }
    if (!isAllowedDocPath(manifestPath) || !fs7.existsSync(manifestPath)) {
      return res.status(400).json({ error: "manifestPath is not accessible" });
    }
    const task = queueShortVideoTask(
      "short_video_account_research",
      `python3 ${path7.join(process.cwd(), "scripts", "run_short_video_account_research.py")} --manifest-path <\u6837\u672C\u6E05\u5355\u8DEF\u5F84>`,
      {
        \u6837\u672C\u6E05\u5355\u8DEF\u5F84: manifestPath,
        API_KEY: apiKey
      }
    );
    return res.json({
      success: true,
      message: "Short-video account research queued",
      task
    });
  });
  app.post("/api/v1/control-plane/short-video/creative-brief", (req, res) => {
    const researchBundlePath = typeof req.body?.researchBundlePath === "string" ? path7.resolve(req.body.researchBundlePath.trim()) : "";
    const selectedContentIds = Array.isArray(req.body?.selectedContentIds) ? req.body.selectedContentIds.map((item) => String(item).trim()).filter(Boolean) : [];
    const targetPlatform = typeof req.body?.targetPlatform === "string" && req.body.targetPlatform.trim() ? req.body.targetPlatform.trim() : "douyin";
    const targetGoal = typeof req.body?.targetGoal === "string" && req.body.targetGoal.trim() ? req.body.targetGoal.trim() : "\u4EA7\u51FA\u53E3\u64AD\u4F18\u5148\u7684\u77ED\u89C6\u9891\u521B\u4F5C\u5305";
    const imitationStrategy = typeof req.body?.imitationStrategy === "string" ? req.body.imitationStrategy.trim() : "";
    const tone = typeof req.body?.tone === "string" ? req.body.tone.trim() : "";
    const durationTarget = Number(req.body?.durationTarget ?? 35);
    if (!researchBundlePath) {
      return res.status(400).json({ error: "researchBundlePath is required" });
    }
    if (!isAllowedDocPath(researchBundlePath) || !fs7.existsSync(researchBundlePath)) {
      return res.status(400).json({ error: "researchBundlePath is not accessible" });
    }
    const task = queueShortVideoTask(
      "short_video_creative_brief",
      `python3 ${path7.join(process.cwd(), "scripts", "run_short_video_creative_brief.py")} --research-bundle-path <\u8D26\u53F7\u7814\u7A76\u5305\u8DEF\u5F84>`,
      {
        \u8D26\u53F7\u7814\u7A76\u5305\u8DEF\u5F84: researchBundlePath,
        \u9009\u4E2D\u7684\u5185\u5BB9ID\u5217\u8868: selectedContentIds.join(","),
        \u76EE\u6807\u5E73\u53F0: targetPlatform,
        \u521B\u4F5C\u76EE\u6807: targetGoal,
        \u6A21\u4EFF\u7B56\u7565: imitationStrategy,
        \u8BED\u6C14: tone,
        \u76EE\u6807\u65F6\u957F\u79D2: String(Number.isFinite(durationTarget) ? durationTarget : 35)
      }
    );
    return res.json({
      success: true,
      message: "Creative brief queued",
      task
    });
  });
  app.post("/api/v1/control-plane/short-video/director-production", (req, res) => {
    const creativeBriefPath = typeof req.body?.creativeBriefPath === "string" ? path7.resolve(req.body.creativeBriefPath.trim()) : "";
    const generateAiClips = Boolean(req.body?.generateAiClips);
    if (!creativeBriefPath) {
      return res.status(400).json({ error: "creativeBriefPath is required" });
    }
    if (!isAllowedDocPath(creativeBriefPath) || !fs7.existsSync(creativeBriefPath)) {
      return res.status(400).json({ error: "creativeBriefPath is not accessible" });
    }
    const task = queueShortVideoTask(
      "short_video_director_production",
      `python3 ${path7.join(process.cwd(), "scripts", "run_short_video_director_production.py")} --creative-brief-path <creative_brief \u8DEF\u5F84>`,
      {
        "creative_brief \u8DEF\u5F84": creativeBriefPath,
        \u662F\u5426\u751F\u6210AI\u8865\u955C: generateAiClips ? "yes" : "no"
      }
    );
    return res.json({
      success: true,
      message: "Director production queued",
      task
    });
  });
  app.post("/api/v1/control-plane/short-video/notebooklm-enhance", (req, res) => {
    const researchBundlePath = typeof req.body?.researchBundlePath === "string" ? path7.resolve(req.body.researchBundlePath.trim()) : "";
    const creativeBriefPath = typeof req.body?.creativeBriefPath === "string" ? path7.resolve(req.body.creativeBriefPath.trim()) : "";
    if (!researchBundlePath) {
      return res.status(400).json({ error: "researchBundlePath is required" });
    }
    if (!creativeBriefPath) {
      return res.status(400).json({ error: "creativeBriefPath is required" });
    }
    if (!isAllowedDocPath(researchBundlePath) || !fs7.existsSync(researchBundlePath)) {
      return res.status(400).json({ error: "researchBundlePath is not accessible" });
    }
    if (!isAllowedDocPath(creativeBriefPath) || !fs7.existsSync(creativeBriefPath)) {
      return res.status(400).json({ error: "creativeBriefPath is not accessible" });
    }
    const task = queueShortVideoTask(
      "notebooklm_account_enhance",
      `python3 ${path7.join(process.cwd(), "scripts", "run_notebooklm_account_enhance.py")} --research-bundle-path <\u8D26\u53F7\u7814\u7A76\u5305\u8DEF\u5F84> --creative-brief-path <creative_brief \u8DEF\u5F84>`,
      {
        \u8D26\u53F7\u7814\u7A76\u5305\u8DEF\u5F84: researchBundlePath,
        "creative_brief \u8DEF\u5F84": creativeBriefPath
      }
    );
    return res.json({
      success: true,
      message: "NotebookLM enhancement queued",
      task
    });
  });
  app.post("/api/v1/control-plane/short-video/inspiration-capture", (req, res) => {
    const videoUrl = typeof req.body?.videoUrl === "string" ? req.body.videoUrl.trim() : "";
    const objective = typeof req.body?.objective === "string" && req.body.objective.trim() ? req.body.objective.trim() : "\u628A\u6536\u85CF\u89C6\u9891\u6C89\u6DC0\u6210\u53EF\u9605\u8BFB\u3001\u53EF\u68C0\u7D22\u3001\u53EF\u7EE7\u7EED\u63D0\u95EE\u7684\u6D1E\u5BDF\u8BB0\u5F55";
    const reflectionNote = typeof req.body?.reflectionNote === "string" ? req.body.reflectionNote.trim() : "";
    const collectionName = typeof req.body?.collectionName === "string" && req.body.collectionName.trim() ? req.body.collectionName.trim() : "\u6536\u85CF\u89C6\u9891";
    const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
    if (!videoUrl) {
      return res.status(400).json({ error: "videoUrl is required" });
    }
    const task = queueShortVideoTask(
      "short_video_insight_capture",
      `python3 ${path7.join(process.cwd(), "scripts", "run_saved_video_insight_capture.py")} --video-url <\u6536\u85CF\u89C6\u9891\u94FE\u63A5>`,
      {
        \u6536\u85CF\u89C6\u9891\u94FE\u63A5: videoUrl,
        \u6D1E\u5BDF\u76EE\u6807: objective,
        \u6536\u85CF\u5907\u6CE8: reflectionNote,
        \u6536\u85CF\u96C6\u5408\u540D: collectionName,
        API_KEY: apiKey
      }
    );
    return res.json({
      success: true,
      message: "Saved video insight capture queued",
      task
    });
  });
  app.post("/api/v1/heartbeat", (req, res) => {
    const nextAgentId = typeof req.body?.agentId === "string" && req.body.agentId.trim() ? req.body.agentId.trim() : agentState.id;
    agentState = {
      id: nextAgentId ?? "openclaw-agent",
      online: true,
      lastSeenAt: now()
    };
    emitHeartbeat(clients);
    res.json({ success: true });
  });
  app.post("/api/v1/knowledge/ingest", (req, res) => {
    const action = req.body?.action === "delete" ? "delete" : "upsert";
    const payload = req.body?.payload;
    if (!payload?.id) {
      return res.status(400).json({ error: "Knowledge payload is required" });
    }
    if (action === "delete") {
      deleteKnowledge(payload.id);
    } else {
      upsertKnowledge(payload);
    }
    broadcast(clients, {
      type: "knowledge",
      action,
      payload
    });
    res.json({ success: true });
  });
  app.get("/api/v1/input-profiles", (req, res) => {
    const nodeId = typeof req.query.nodeId === "string" ? req.query.nodeId.trim() : "";
    if (!nodeId) {
      return res.status(400).json({ error: "nodeId is required" });
    }
    const store = readInputProfiles();
    const record = store[nodeId] ?? { profiles: [] };
    return res.json(record);
  });
  app.post("/api/v1/input-profiles", (req, res) => {
    const nodeId = typeof req.body?.nodeId === "string" ? req.body.nodeId.trim() : "";
    const profileId = typeof req.body?.profileId === "string" ? req.body.profileId.trim() : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const setDefault = Boolean(req.body?.setDefault);
    const values = req.body?.values && typeof req.body.values === "object" ? sanitizeProfileValues(req.body.values) : {};
    if (!nodeId || !name) {
      return res.status(400).json({ error: "nodeId and name are required" });
    }
    const store = readInputProfiles();
    const current = store[nodeId] ?? { profiles: [] };
    const nowStamp = (/* @__PURE__ */ new Date()).toISOString();
    const nextId = profileId || `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const existing = current.profiles.find((item) => item.id === nextId);
    if (existing) {
      existing.name = name;
      existing.values = values;
      existing.updatedAt = nowStamp;
    } else {
      current.profiles.unshift({
        id: nextId,
        name,
        values,
        updatedAt: nowStamp
      });
    }
    current.profiles = current.profiles.slice(0, 20);
    if (setDefault || !current.defaultProfileId) {
      current.defaultProfileId = nextId;
    }
    store[nodeId] = current;
    writeInputProfiles(store);
    return res.json({
      success: true,
      defaultProfileId: current.defaultProfileId,
      profiles: current.profiles
    });
  });
  app.post("/api/v1/node-update", (req, res) => {
    const { nodeId, status, drawerContent } = req.body ?? {};
    if (!nodeId || !status) {
      return res.status(400).json({ error: "nodeId and status are required" });
    }
    broadcast(clients, {
      type: "node-update",
      nodeId,
      status,
      drawerContent
    });
    res.json({ success: true, message: `Node ${nodeId} updated to ${status}` });
  });
  app.post("/api/v1/update-vibe", (_req, res) => {
    res.redirect(307, "/api/v1/node-update");
  });
  app.post("/api/v1/node-execute", (req, res) => {
    const {
      nodeId,
      command,
      inputValues,
      sourcePath,
      sourceType,
      inputSchema,
      route,
      requiredSkills
    } = req.body ?? {};
    if (!nodeId || !command) {
      return res.status(400).json({ error: "nodeId and command are required" });
    }
    const task = createTask(nodeId, command, {
      inputValues: inputValues && typeof inputValues === "object" ? inputValues : {},
      sourcePath: typeof sourcePath === "string" ? sourcePath : void 0,
      sourceType,
      inputSchema: Array.isArray(inputSchema) ? inputSchema : [],
      route: route && typeof route === "object" ? route : void 0,
      requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
      targetDir: inputValues && typeof inputValues === "object" && typeof inputValues["\u76EE\u6807\u76EE\u5F55"] === "string" ? path7.resolve(inputValues["\u76EE\u6807\u76EE\u5F55"]) : void 0,
      archiveRule: inputValues && typeof inputValues === "object" && typeof inputValues["\u5F52\u6863\u89C4\u5219\u8BF4\u660E"] === "string" ? inputValues["\u5F52\u6863\u89C4\u5219\u8BF4\u660E"] : void 0,
      assetRootPath: buildAssetRootState().path
    });
    commandQueue.push(task);
    persistTask(task);
    broadcast(clients, {
      type: "task-queued",
      payload: task
    });
    emitHeartbeat(clients);
    res.json({
      success: true,
      message: `Execution command queued for ${nodeId}`,
      task
    });
  });
  app.post("/api/v1/bundles/export", (req, res) => {
    const nodeId = typeof req.body?.nodeId === "string" ? req.body.nodeId.trim() : "";
    const exportAll = Boolean(req.body?.all);
    if (!nodeId && !exportAll) {
      return res.status(400).json({ error: "nodeId or all is required" });
    }
    const args = [
      "scripts/export_sop_bundle.py",
      "--output-dir",
      path7.join(process.cwd(), "exports", "bundles"),
      "--base-url",
      `http://127.0.0.1:${port}`,
      "--json"
    ];
    if (exportAll) {
      args.push("--all");
    } else {
      args.push("--node-id", nodeId);
    }
    const exportProcess = spawnSync("python3", args, {
      cwd: process.cwd(),
      encoding: "utf-8",
      timeout: 6e4
    });
    if (exportProcess.status !== 0) {
      return res.status(500).json({
        error: exportProcess.stderr?.trim() || exportProcess.stdout?.trim() || "Bundle export failed"
      });
    }
    try {
      const payload = JSON.parse(exportProcess.stdout.trim());
      return res.json({ success: true, ...payload });
    } catch {
      return res.status(500).json({ error: "Bundle export returned invalid JSON" });
    }
  });
  app.post("/api/v1/agent/poll", (req, res) => {
    const requestedAgentId = typeof req.body?.agentId === "string" && req.body.agentId.trim() ? req.body.agentId.trim() : "openclaw-agent";
    agentState = {
      id: requestedAgentId,
      online: true,
      lastSeenAt: now()
    };
    recycleStaleClaims();
    const task = commandQueue.find((item) => item.status === "queued") ?? null;
    if (task) {
      task.status = "claimed";
      task.updatedAt = now();
      task.agentId = requestedAgentId;
      task.stage = "claimed";
      task.decisionState = {
        status: "watch",
        priority: task.executionMode === "asset-organize" || task.executionMode === "asset-index" ? "p2" : "p3",
        reason: "Resident agent claimed the task and is preparing execution.",
        nextAction: "Wait for execution output or inspect blockers if the claim stalls."
      };
      persistTask(task);
      broadcast(clients, {
        type: "task-claimed",
        payload: task
      });
    }
    emitHeartbeat(clients);
    res.json({ success: true, task });
  });
  app.post("/api/v1/agent/task-update", (req, res) => {
    const payload = req.body ?? {};
    if (!payload.taskId || !payload.status) {
      return res.status(400).json({ error: "taskId and status are required" });
    }
    const task = commandQueue.find((item) => item.id === payload.taskId);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    task.status = payload.status;
    task.updatedAt = now();
    task.agentId = payload.agentId ?? task.agentId;
    task.resultSummary = payload.resultSummary ?? task.resultSummary;
    task.resultDetail = payload.resultDetail ?? task.resultDetail;
    task.stage = payload.stage ?? stageForStatus(payload.status);
    task.evidenceLevel = payload.evidenceLevel ?? task.evidenceLevel;
    task.artifactRefs = Array.isArray(payload.artifactRefs) ? payload.artifactRefs : task.artifactRefs;
    task.blocker = payload.blocker && typeof payload.blocker === "object" ? payload.blocker : task.blocker;
    task.decisionState = payload.decisionState && typeof payload.decisionState === "object" ? payload.decisionState : task.decisionState;
    persistTask(normalizeTask(task));
    if (Array.isArray(payload.runtimeSkillsUsed) && payload.runtimeSkillsUsed.length > 0) {
      recordRuntimeSkillEvidence(task.nodeId, payload.runtimeSkillsUsed);
    }
    if (payload.nodeStatus) {
      broadcast(clients, {
        type: "node-update",
        nodeId: task.nodeId,
        status: payload.nodeStatus,
        drawerContent: payload.drawerContent
      });
    }
    if (payload.knowledgePayload) {
      const action = payload.knowledgeAction ?? "upsert";
      if (action === "delete") {
        deleteKnowledge(payload.knowledgePayload.id);
      } else {
        upsertKnowledge(payload.knowledgePayload);
      }
      broadcast(clients, {
        type: "knowledge",
        action,
        payload: payload.knowledgePayload
      });
    }
    broadcast(clients, {
      type: "task-updated",
      payload: task
    });
    emitHeartbeat(clients);
    res.json({ success: true, task });
  });
  app.post("/api/v1/task-feedback", (req, res) => {
    const taskId = typeof req.body?.taskId === "string" ? req.body.taskId.trim() : "";
    const sentiment = typeof req.body?.sentiment === "string" ? req.body.sentiment.trim() : "note";
    const feedback = typeof req.body?.feedback === "string" ? req.body.feedback.trim() : "";
    if (!taskId || !feedback) {
      return res.status(400).json({ error: "taskId and feedback are required" });
    }
    const task = commandQueue.find((item) => item.id === taskId) ?? readTaskHistory().find((item) => item.id === taskId);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    const feedbackRoot = path7.join(runtimeRoot2, "knowledge", "feedback");
    const evolutionRoot = path7.join(runtimeRoot2, "knowledge", "evolution");
    ensureDir(feedbackRoot);
    ensureDir(evolutionRoot);
    const suggestions = feedbackSuggestions(feedback, task, sentiment);
    const feedbackPath = path7.join(feedbackRoot, `${task.id}.md`);
    const evolutionPath = path7.join(evolutionRoot, `${task.id}.md`);
    const artifactPaths = Array.isArray(req.body?.artifacts) ? req.body.artifacts.filter((item) => typeof item === "string" && item.startsWith("/")) : [];
    const feedbackMarkdown = [
      "---",
      `id: ${task.id}`,
      "type: user-feedback",
      "evidence: human-feedback",
      `node_id: ${task.nodeId}`,
      `task_status: ${task.status}`,
      `sentiment: ${sentiment}`,
      `updated_at: ${(/* @__PURE__ */ new Date()).toISOString()}`,
      "---",
      "",
      `# ${task.nodeLabel} \u7528\u6237\u53CD\u9988`,
      "",
      "## Feedback",
      "",
      feedback,
      "",
      "## Task Summary",
      "",
      `- Result: ${task.resultSummary ?? "No summary"}`,
      `- Command: \`${task.command}\``,
      "",
      "## Artifacts",
      "",
      ...artifactPaths.length > 0 ? artifactPaths.map((item) => `- ${item}`) : ["- None"],
      "",
      "## Result Detail",
      "",
      "```text",
      (task.resultDetail ?? "").slice(0, 6e3),
      "```",
      ""
    ].join("\n");
    const evolutionMarkdown = [
      "---",
      `id: evo-${task.id}`,
      "type: evolution-note",
      "evidence: human-feedback",
      `node_id: ${task.nodeId}`,
      `updated_at: ${(/* @__PURE__ */ new Date()).toISOString()}`,
      "---",
      "",
      `# ${task.nodeLabel} \u81EA\u8FDB\u5316\u5EFA\u8BAE`,
      "",
      "## User Feedback",
      "",
      feedback,
      "",
      "## Recommended Updates",
      "",
      ...suggestions.map((item) => `- ${item}`),
      "",
      "## Next Run Checklist",
      "",
      "- Re-run this SOP after applying the relevant fixes.",
      "- Verify the final artifact can be opened directly from the dashboard.",
      "- Keep this feedback linked to the SOP knowledge base.",
      ""
    ].join("\n");
    fs7.writeFileSync(feedbackPath, feedbackMarkdown, "utf-8");
    fs7.writeFileSync(evolutionPath, evolutionMarkdown, "utf-8");
    const knowledgePayload = {
      id: `kb-feedback-${task.id}`,
      evidenceLevel: "runtime",
      knowledgeType: "feedback",
      sourceKind: "feedback",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      human: {
        title: `${task.nodeLabel} Feedback`,
        summary: feedback.slice(0, 160),
        content_md: feedbackMarkdown,
        tags: ["feedback", sentiment, task.nodeId],
        domain: "User Feedback",
        platform: "OpenClaw Evolution",
        links: [
          { title: "Feedback Note", url: `/api/v1/doc?path=${encodeURIComponent(feedbackPath)}` },
          { title: "Evolution Note", url: `/api/v1/doc?path=${encodeURIComponent(evolutionPath)}` }
        ],
        examples: suggestions.slice(0, 3).map((item, index) => ({
          title: `Suggestion ${index + 1}`,
          summary: item
        }))
      },
      machine: {
        intent: "task_feedback",
        entities: {
          taskId: task.id,
          nodeId: task.nodeId,
          sentiment
        },
        steps: suggestions,
        commands: [],
        constraints: []
      }
    };
    upsertKnowledge(knowledgePayload);
    broadcast(clients, {
      type: "knowledge",
      action: "upsert",
      payload: knowledgePayload
    });
    const qmdUpdate = runQmdUpdateSync();
    const evolutionTask = createTask(task.nodeId, `__OPENCLAW_EVOLUTION__ ${task.id}`, {
      sourcePath: task.context?.sourcePath,
      sourceType: task.context?.sourceType,
      inputValues: task.context?.inputValues,
      inputSchema: task.context?.inputSchema,
      route: task.context?.route,
      requiredSkills: task.context?.requiredSkills,
      feedbackPath,
      evolutionPath,
      originalTaskId: task.id,
      originalResultSummary: task.resultSummary,
      originalResultDetail: task.resultDetail,
      artifactPaths
    });
    evolutionTask.nodeLabel = `\u81EA\u8FDB\u5316\uFF1A${task.nodeLabel}`;
    evolutionTask.familyId = task.familyId || taskFamilyId(task.nodeId);
    evolutionTask.familyLabel = task.familyLabel || task.nodeLabel;
    commandQueue.push(evolutionTask);
    persistTask(evolutionTask);
    broadcast(clients, {
      type: "task-queued",
      payload: evolutionTask
    });
    emitHeartbeat(clients);
    return res.json({
      success: true,
      summary: `Feedback saved for ${task.nodeLabel} and evolution task queued.`,
      feedbackPath,
      evolutionPath,
      suggestions,
      evolutionTaskId: evolutionTask.id,
      qmdUpdate
    });
  });
  app.post("/api/v1/knowledge/search", (req, res) => {
    const { query, domain, platform } = req.body ?? {};
    const qmdResults = searchQmdKnowledge(query);
    res.json({
      results: [...searchKnowledge(query, domain, platform), ...qmdResults]
    });
  });
  app.get("/api/v1/task-history", (req, res) => {
    const offsetRaw = typeof req.query.offset === "string" ? parseInt(req.query.offset, 10) : 0;
    const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : DEFAULT_HISTORY_GROUP_LIMIT;
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 20) : DEFAULT_HISTORY_GROUP_LIMIT;
    const persisted = readTaskHistory().filter(
      (task) => task.status === "completed" || task.status === "failed"
    );
    const liveRecent = commandQueue.filter(
      (task) => task.status === "completed" || task.status === "failed"
    );
    const merged = [...persisted, ...liveRecent].filter(
      (task, index, array) => array.findIndex((item) => item.id === task.id) === index
    );
    const groups = groupTaskHistory(merged);
    const sliced = groups.slice(offset, offset + limit);
    const nextOffset = offset + limit < groups.length ? offset + limit : null;
    res.json({
      groups: sliced,
      nextOffset,
      hasMore: nextOffset !== null,
      totalGroups: groups.length
    });
  });
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }
  app.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}`);
    console.log("SoloCore broker endpoints ready:");
    console.log("  UI SSE:          GET  /api/v1/stream");
    console.log("  Agent poll:      POST /api/v1/agent/poll");
    console.log("  Agent task sync: POST /api/v1/agent/task-update");
    console.log(`  App dev session: ${APP_DEV_SESSION_ID}`);
    bootstrapAppDevSession();
    if (residentAgentAutostartEnabled()) {
      setTimeout(() => {
        residentAgentStartGracePassed = true;
        ensureResidentAgent();
      }, RESIDENT_AGENT_START_GRACE_MS);
    }
  });
}
process.on("SIGINT", () => {
  clearResidentAgentRestartTimer();
  residentAgentProcess?.kill("SIGTERM");
});
process.on("SIGTERM", () => {
  clearResidentAgentRestartTimer();
  residentAgentProcess?.kill("SIGTERM");
});
startServer();
