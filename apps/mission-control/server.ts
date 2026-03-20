import express from "express";
import { spawn, spawnSync } from "node:child_process";
import { createServer as createViteServer } from "vite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { seedKnowledgeBase } from "./src/data/mockKnowledge";
import { mockSkillNodes } from "./src/data/mockData";
import {
  getAssetRootConfigPath,
  getNamingContract,
  getSuggestedAssetRootPath,
  isPathInsideAssetRoot,
  readAgentOsConfig,
  updateAgentOsConfig,
} from "./src/server/agentOsConfig";
import {
  deriveDecisionQueue,
  summarizeDecisions,
} from "./src/server/decisionQueue";
import { buildWorkspaceKnowledgeItems } from "./src/server/knowledgeLoader";
import { loadSkillTreeNodes, recordRuntimeSkillEvidence } from "./src/server/skillTreeLoader";
import { getSkillSourceRoots } from "./src/server/skillIndex";
import {
  AgentStatus,
  AgentTask,
  AgentTaskStatus,
  AssetRootConfig,
  ControlPlaneState,
  DecisionPriority,
  DecisionQueueItem,
  EvidenceLevel,
  ExecutionMode,
  KnowledgeItem,
  NodeStatus,
  SkillModule,
  SkillNode,
  TaskArtifact,
  TaskBlocker,
  TaskDecisionState,
  TaskStage,
} from "./src/types";

type StreamEvent =
  | { type: "connected" }
  | { type: "heartbeat"; payload: ReturnType<typeof buildHeartbeatPayload> }
  | { type: "knowledge"; action: "upsert" | "delete"; payload: KnowledgeItem }
  | {
      type: "node-update";
      nodeId: string;
      status: NodeStatus;
      drawerContent?: unknown;
    }
  | { type: "task-queued" | "task-claimed" | "task-updated"; payload: AgentTask };

type TaskUpdateStatus = Extract<
  AgentTaskStatus,
  "running" | "completed" | "failed"
>;

interface TaskUpdateRequest {
  agentId?: string;
  taskId?: string;
  status?: TaskUpdateStatus;
  nodeStatus?: NodeStatus;
  drawerContent?: unknown;
  resultSummary?: string;
  resultDetail?: string;
  stage?: TaskStage;
  evidenceLevel?: EvidenceLevel;
  artifactRefs?: TaskArtifact[];
  blocker?: TaskBlocker;
  decisionState?: TaskDecisionState;
  runtimeSkillsUsed?: SkillModule[];
  knowledgeAction?: "upsert" | "delete";
  knowledgePayload?: KnowledgeItem;
}

const HEARTBEAT_INTERVAL_MS = 5000;
const AGENT_OFFLINE_TIMEOUT_MS = 15000;
const TASK_CLAIM_TIMEOUT_MS = 30000;
const MAX_RECENT_TASKS = 8;
const DEFAULT_HISTORY_GROUP_LIMIT = 6;
const APP_DEV_SESSION_ID = "openclaw-web-app-dev";
const homeDir = os.homedir();
const workspaceRoot = path.join(homeDir, ".openclaw", "workspace");
const taskHistoryPath = path.join(
  workspaceRoot,
  "agents",
  "runtime",
  "task-history.json",
);
const docRoots = [
  path.join(homeDir, ".openclaw"),
  ...getSkillSourceRoots(),
  process.cwd(),
];
const fileActionRoots = [
  ...docRoots,
  path.join(homeDir, "Desktop"),
  path.join(homeDir, "Downloads"),
];
const knowledgeCasesRoot = path.join(workspaceRoot, "agents", "knowledge", "cases");
const runtimeLessonsRoot = path.join(workspaceRoot, "agents", "knowledge", "runtime-lessons");
const legacyAssetRoots = [path.join(workspaceRoot, "content_system")];

const runtimeKnowledgeDb: KnowledgeItem[] = [...seedKnowledgeBase];
const commandQueue: AgentTask[] = [];
let agentState: AgentStatus = {
  id: null,
  online: false,
  lastSeenAt: null,
};
let appDevSessionBootstrapped = false;

function now() {
  return Date.now();
}

function inferExecutionMode(nodeId: string, command: string): ExecutionMode {
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
  if (normalized.startsWith("__OPENCLAW_WORKFLOW__")) {
    return "workflow";
  }
  if (normalized.startsWith("/")) {
    return "slash";
  }
  if (
    normalized.startsWith("python ") ||
    normalized.startsWith("python3 ") ||
    normalized.startsWith("npm ") ||
    normalized.startsWith("node ") ||
    normalized.startsWith("uv ") ||
    normalized.startsWith("claw ")
  ) {
    return "shell";
  }
  return "unknown";
}

function stageForStatus(status: AgentTaskStatus): TaskStage {
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

function isPathInsideLegacyRoots(targetPath: string) {
  const resolved = path.resolve(targetPath);
  return legacyAssetRoots.some((root) => {
    const absoluteRoot = path.resolve(root);
    return resolved === absoluteRoot || resolved.startsWith(`${absoluteRoot}${path.sep}`);
  });
}

function buildAssetRootState(): AssetRootConfig {
  const config = readAgentOsConfig();
  const configPath = getAssetRootConfigPath();
  const configured = fs.existsSync(configPath);
  const naming = getNamingContract();
  return {
    path: path.resolve(config.assetRootPath),
    configured,
    source: configured ? "saved" : "default",
    configPath,
    suggestedPath: getSuggestedAssetRootPath(),
    legacyWorkspaceRoots: legacyAssetRoots,
    namingContract: {
      version: "v1",
      summary: [
        "New long-term assets use a type prefix + date/version + status suffix.",
        "Human-readable and AI-readable companions share the same base name and differ only by the role suffix.",
        "Draft and final artifacts keep separate suffixes so the latest stable result remains easy to locate.",
      ],
      rules: [
        {
          id: "type-prefix",
          label: "Type Prefix",
          pattern: Object.entries(naming.typePrefixes)
            .map(([kind, prefix]) => `${kind}:${prefix}`)
            .join(", "),
          example: "DOC__20260319__mission-control-brief__draft__human.md",
        },
        {
          id: "human-ai-pair",
          label: "Human/AI Pairing",
          pattern: `<base>${naming.humanAiPairGuidance.separator}<human|ai>`,
          example: `topic${naming.humanAiPairGuidance.separator}${naming.humanAiPairGuidance.humanSuffix}.md / topic${naming.humanAiPairGuidance.separator}${naming.humanAiPairGuidance.aiSuffix}.md`,
        },
        {
          id: "status",
          label: "Status Suffix",
          pattern: Object.values(naming.statusLabels).join(" | "),
          example: "DATA__20260319__comment-batch__review__ai.json",
        },
        {
          id: "version",
          label: "Version",
          pattern: naming.versionPattern,
          example: "PLN__20260319__agent-os-rollout__v1.0__final__human.md",
        },
      ],
    },
  };
}

function normalizeDecisionPriority(priority: string): DecisionPriority {
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

function ensureTaskRuntimeDir() {
  fs.mkdirSync(path.dirname(taskHistoryPath), { recursive: true });
}

function readMarkdownFiles(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => path.join(dirPath, entry.name))
    .sort();
}

function parseJsonBlock(text: string, heading: string) {
  const regex = new RegExp(`##\\s+${heading}\\s*\\n\\n\\\`\\\`\\\`json\\n([\\s\\S]*?)\\n\\\`\\\`\\\``, "i");
  const match = text.match(regex);
  if (!match) {
    return {};
  }
  try {
    return JSON.parse(match[1]) as Record<string, string>;
  } catch {
    return {};
  }
}

function parseTextBlock(text: string, heading: string) {
  const regex = new RegExp(`##\\s+${heading}\\s*\\n\\n\\\`\\\`\\\`text\\n([\\s\\S]*?)\\n\\\`\\\`\\\``, "i");
  return text.match(regex)?.[1]?.trim() ?? "";
}

function parseSimpleSection(text: string, heading: string) {
  const regex = new RegExp(`##\\s+${heading}\\s*\\n\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "i");
  return text.match(regex)?.[1]?.trim() ?? "";
}

function backfillTaskHistoryFromKnowledge() {
  const files = [
    ...readMarkdownFiles(knowledgeCasesRoot).map((file) => ({ file, status: "completed" as const })),
    ...readMarkdownFiles(runtimeLessonsRoot).map((file) => ({ file, status: "failed" as const })),
  ];

  return files
    .map(({ file, status }) => {
      const markdown = fs.readFileSync(file, "utf-8");
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
        resultSummary:
          status === "completed"
            ? `${title} finished successfully.`
            : `${title} failed.`,
        resultDetail: output,
        context: {
          inputValues: inputs,
          sourcePath: file,
        },
      } satisfies AgentTask;
    })
    .filter(Boolean)
    .map((task) => normalizeTask(task as AgentTask)) as AgentTask[];
}

function readTaskHistory(): AgentTask[] {
  if (!fs.existsSync(taskHistoryPath)) {
    const backfilled = backfillTaskHistoryFromKnowledge();
    if (backfilled.length > 0) {
      writeTaskHistory(backfilled);
    }
    return backfilled;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(taskHistoryPath, "utf-8")) as AgentTask[];
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

function writeTaskHistory(tasks: AgentTask[]) {
  ensureTaskRuntimeDir();
  fs.writeFileSync(taskHistoryPath, JSON.stringify(tasks, null, 2), "utf-8");
}

function persistTask(task: AgentTask) {
  const history = readTaskHistory();
  const next = history.filter((item) => item.id !== task.id);
  next.push(normalizeTask(task));
  next.sort((a, b) => b.updatedAt - a.updatedAt);
  writeTaskHistory(next.slice(0, 2000));
}

function taskFamilyId(nodeId: string) {
  return `family-${nodeId}`;
}

function normalizeTask(task: AgentTask): AgentTask {
  const executionMode = task.executionMode ?? inferExecutionMode(task.nodeId, task.command);
  return {
    ...task,
    familyId: task.familyId || taskFamilyId(task.nodeId),
    familyLabel: task.familyLabel || task.nodeLabel,
    executionMode,
    stage: task.stage ?? stageForStatus(task.status),
    evidenceLevel: task.evidenceLevel ?? (task.status === "completed" || task.status === "failed" ? "runtime" : "declared"),
  };
}

function groupTaskHistory(tasks: AgentTask[]) {
  const groups = new Map<string, AgentTask[]>();
  for (const task of tasks) {
    const familyId = task.familyId || taskFamilyId(task.nodeId);
    const bucket = groups.get(familyId) ?? [];
    bucket.push({
      ...task,
      familyId,
      familyLabel: task.familyLabel || task.nodeLabel,
    });
    groups.set(familyId, bucket);
  }

  return [...groups.entries()]
    .map(([familyId, groupTasks]) => {
      const sortedTasks = [...groupTasks].sort((a, b) => b.updatedAt - a.updatedAt);
      const latest = sortedTasks[0];
      const canonical =
        sortedTasks.find((item) => !item.nodeLabel.startsWith("自进化：")) ?? latest;
      return {
        familyId,
        familyLabel: canonical.familyLabel || canonical.nodeLabel,
        nodeId: canonical.nodeId,
        latestUpdatedAt: latest.updatedAt,
        totalRuns: sortedTasks.length,
        completedRuns: sortedTasks.filter((item) => item.status === "completed").length,
        failedRuns: sortedTasks.filter((item) => item.status === "failed").length,
        tasks: sortedTasks.slice(0, 8),
      };
    })
    .sort((a, b) => b.latestUpdatedAt - a.latestUpdatedAt);
}

function taskTargetDir(task: AgentTask) {
  return (
    task.context?.targetDir ||
    task.context?.inputValues?.["目标目录"] ||
    task.context?.inputValues?.["targetDir"] ||
    null
  );
}

function latestConfirmedKnowledgeForNode(nodeId: string) {
  return getKnowledgeDb()
    .filter(
      (item) =>
        item.evidenceLevel === "confirmed" &&
        item.machine?.entities?.nodeId === nodeId,
    )
    .sort((a, b) => Date.parse(b.updatedAt ?? "") - Date.parse(a.updatedAt ?? ""))[0];
}

function decisionTitleFromId(id: string) {
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

function buildTaskDecisionQueue(): DecisionQueueItem[] {
  const assetRoot = buildAssetRootState();
  const mergedTasks = [
    ...readTaskHistory(),
    ...commandQueue.map((task) => normalizeTask(task)),
  ].filter((task, index, list) => list.findIndex((item) => item.id === task.id) === index);
  const latestByNode = new Map<string, AgentTask>();
  for (const task of mergedTasks) {
    const existing = latestByNode.get(task.nodeId);
    if (!existing || task.updatedAt > existing.updatedAt) {
      latestByNode.set(task.nodeId, task);
    }
  }

  const failureWindowMs = 1000 * 60 * 60 * 24;
  const decisions: DecisionQueueItem[] = [];

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
          path: assetRoot.suggestedPath,
        },
      ],
    });
  }

  for (const task of latestByNode.values()) {
    const targetDir = taskTargetDir(task);
    const confirmedKnowledge = latestConfirmedKnowledgeForNode(task.nodeId);
    const failedCount = mergedTasks.filter(
      (item) =>
        item.nodeId === task.nodeId &&
        item.status === "failed" &&
        now() - item.updatedAt <= failureWindowMs,
    ).length;
    const queuedIndexFollowUp =
      task.nodeId === "project_file_organize" &&
      commandQueue.some(
        (item) =>
          item.nodeId === "project_file_index" &&
          taskTargetDir(item) === targetDir &&
          (item.status === "queued" || item.status === "claimed" || item.status === "running"),
      );

    const rawDecisions = deriveDecisionQueue(
      {
        id: task.id,
        title: task.nodeLabel,
        blocked: task.status === "failed" || Boolean(task.blocker),
        blockReason: task.blocker?.summary ?? task.resultSummary,
        assetState:
          task.executionMode === "asset-organize" || task.executionMode === "asset-index"
            ? {
                configured: assetRoot.configured || Boolean(targetDir && isPathInsideLegacyRoots(targetDir)),
                path: targetDir ?? assetRoot.path,
              }
            : undefined,
        evidence:
          task.status === "completed"
            ? {
                lastCapturedAt: new Date(task.updatedAt).toISOString(),
                lastConfirmedAt: confirmedKnowledge?.updatedAt,
                needsRefresh: !confirmedKnowledge,
                summary: confirmedKnowledge
                  ? "Confirmed evidence exists for this workflow."
                  : "Only declared/runtime evidence exists so far.",
              }
            : undefined,
        failureCluster:
          failedCount >= 3
            ? {
                id: task.nodeId,
                count: failedCount,
                latestError: task.resultSummary,
                windowMinutes: 24 * 60,
              }
            : undefined,
        followUp:
          queuedIndexFollowUp
            ? {
                queued: true,
                reason: "Archive finished and the matching indexing step is already queued.",
                owner: "resident-agent",
                eta: "after current queue clears",
              }
            : undefined,
      },
      {
        asset: {
          configured: assetRoot.configured,
          path: assetRoot.path,
        },
        evidence:
          task.status === "completed"
            ? {
                lastCapturedAt: new Date(task.updatedAt).toISOString(),
                lastConfirmedAt: confirmedKnowledge?.updatedAt,
                needsRefresh: !confirmedKnowledge,
              }
            : undefined,
      },
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
          ...(targetDir
            ? [
                {
                  label: "Target Dir",
                  value: targetDir,
                  path: targetDir,
                },
              ]
            : []),
          {
            label: "Task",
            value: task.id,
          },
        ],
      });
    }
  }

  const seen = new Set<string>();
  return decisions
    .filter((item) => {
      const key = `${item.title}:${item.reason}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const order = { p0: 0, p1: 1, p2: 2, p3: 3 };
      return order[a.priority] - order[b.priority];
    })
    .slice(0, 10);
}

function buildControlPlaneState(): ControlPlaneState {
  return {
    assetRoot: buildAssetRootState(),
    decisionQueue: buildTaskDecisionQueue(),
  };
}

function broadcast(clients: express.Response[], event: StreamEvent) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  clients.forEach((client) => client.write(payload));
}

function refreshAgentStatus() {
  if (!agentState.lastSeenAt) {
    agentState = { ...agentState, online: false };
    return;
  }

  agentState = {
    ...agentState,
    online: now() - agentState.lastSeenAt <= AGENT_OFFLINE_TIMEOUT_MS,
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
    (task) => task.status === "claimed" || task.status === "running",
  ).map((task) => normalizeTask(task));
  const queuedTasks = commandQueue.filter((task) => task.status === "queued").map((task) => normalizeTask(task));
  const recentTasks = [...commandQueue]
    .filter(
      (task) => task.status === "completed" || task.status === "failed",
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_RECENT_TASKS)
    .map((task) => normalizeTask(task));

  return {
    status: agentState.online ? "alive" : "waiting-for-agent",
    timestamp: now(),
    agent: agentState,
    activeTasks,
    queuedTasks,
    recentTasks,
    decisionQueue: buildTaskDecisionQueue(),
  };
}

function emitHeartbeat(clients: express.Response[]) {
  broadcast(clients, {
    type: "heartbeat",
    payload: buildHeartbeatPayload(),
  });
}

function upsertKnowledge(item: KnowledgeItem) {
  const index = runtimeKnowledgeDb.findIndex((entry) => entry.id === item.id);
  if (index >= 0) {
    runtimeKnowledgeDb[index] = item;
    return;
  }
  runtimeKnowledgeDb.unshift(item);
}

function deleteKnowledge(id: string) {
  const index = runtimeKnowledgeDb.findIndex((entry) => entry.id === id);
  if (index >= 0) {
    runtimeKnowledgeDb.splice(index, 1);
  }
}

function getKnowledgeDb() {
  const workspaceItems = buildWorkspaceKnowledgeItems();
  const seen = new Set<string>();
  return [...runtimeKnowledgeDb, ...workspaceItems].filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

function knowledgeEvidenceRank(item: KnowledgeItem) {
  if (item.evidenceLevel === "confirmed") {
    return 0;
  }
  if (item.evidenceLevel === "runtime") {
    return 1;
  }
  return 2;
}

function knowledgeSourceRank(item: KnowledgeItem) {
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

function searchKnowledge(
  query?: string,
  domain?: string,
  platform?: string,
): KnowledgeItem[] {
  const normalizedQuery = (query ?? "").trim();
  return getKnowledgeDb()
    .filter((item) => {
      const matchQuery = normalizedQuery
        ? item.human.title.includes(normalizedQuery) ||
          item.human.summary.includes(normalizedQuery) ||
          item.human.content_md.includes(normalizedQuery) ||
          item.human.tags.some((tag) => tag.includes(normalizedQuery)) ||
          (item.human.links ?? []).some(
            (link) =>
              link.title.includes(normalizedQuery) ||
              link.url.includes(normalizedQuery),
          ) ||
          (item.human.examples ?? []).some(
            (example) =>
              example.title.includes(normalizedQuery) ||
              example.summary.includes(normalizedQuery),
          ) ||
          item.machine.steps.some((step) => step.includes(normalizedQuery)) ||
          item.machine.commands.some((command) =>
            command.includes(normalizedQuery),
          )
        : true;
      const matchDomain = domain ? item.human.domain === domain : true;
      const matchPlatform = platform ? item.human.platform === platform : true;
      return matchQuery && matchDomain && matchPlatform;
    })
    .sort((a, b) => {
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

function qmdResultToKnowledgeItem(
  result: {
    docid?: string;
    score?: number;
    file?: string;
    title?: string;
    snippet?: string;
  },
  collection: string,
): KnowledgeItem {
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
      links: ref
        ? [{ title: result.title || ref, url: `/api/v1/qmd-doc?ref=${encodeURIComponent(ref)}` }]
        : [],
    },
    machine: {
      intent: "qmd_search_result",
      entities: { ref, docid: result.docid, score: result.score },
      steps: [],
      commands: [],
      constraints: [],
    },
  };
}

function searchQmdCollection(query: string, collection: string): KnowledgeItem[] {
  const process = spawnSync(
    "qmd",
    ["search", query, "-c", collection, "--json"],
    {
      encoding: "utf-8",
      timeout: 15000,
    },
  );

  if (process.status !== 0 || !process.stdout.trim()) {
    return [];
  }

  try {
    const items = JSON.parse(process.stdout) as Array<{
      docid?: string;
      score?: number;
      file?: string;
      title?: string;
      snippet?: string;
    }>;
    return items.slice(0, 8).map((item) => qmdResultToKnowledgeItem(item, collection));
  } catch {
    return [];
  }
}

function searchQmdKnowledge(query?: string) {
  const normalizedQuery = (query ?? "").trim();
  if (!normalizedQuery) {
    return [];
  }

  return [
    ...searchQmdCollection(normalizedQuery, "agents-knowledge"),
    ...searchQmdCollection(normalizedQuery, "content-knowledge"),
  ];
}

function createTask(
  nodeId: string,
  command: string,
  context?: AgentTask["context"],
): AgentTask {
  const timestamp = now();
  const skillTreeNodes = getSkillTreeNodes();
  const nodeLabelById = new Map(
    skillTreeNodes.map((node) => [node.id, node.label] as const),
  );
  const executionMode = inferExecutionMode(nodeId, command);
  return {
    id: `task_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
    nodeId,
    nodeLabel: nodeLabelById.get(nodeId) ?? nodeId,
    familyId: taskFamilyId(nodeId),
    familyLabel: nodeLabelById.get(nodeId) ?? nodeId,
    command,
    executionMode,
    status: "queued",
    stage: "queued",
    evidenceLevel: "declared",
    decisionState: {
      status: "watch",
      priority: executionMode === "asset-organize" || executionMode === "asset-index" ? "p2" : "p3",
      reason:
        executionMode === "asset-organize" || executionMode === "asset-index"
          ? "Asset intake task queued and waiting for resident execution."
          : "Task queued and waiting for execution.",
      nextAction: "Wait for the resident agent to claim the task.",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    agentId: null,
    context,
  };
}

function getSkillTreeNodes() {
  const loadedNodes = loadSkillTreeNodes();
  return loadedNodes.length > 0 ? loadedNodes : mockSkillNodes;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderInlineMarkdown(text: string) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderMarkdownDocument(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let listItems: string[] = [];
  let paragraph: string[] = [];

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

function isAllowedDocPath(targetPath: string) {
  const resolved = path.resolve(targetPath);
  return docRoots.some((root) => resolved.startsWith(path.resolve(root)));
}

function isAllowedFileActionPath(targetPath: string) {
  const resolved = path.resolve(targetPath);
  return fileActionRoots.some((root) => resolved.startsWith(path.resolve(root)));
}

function ensureDir(targetPath: string) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function runQmdUpdateSync() {
  const process = spawnSync("qmd", ["update"], {
    cwd: workspaceRoot,
    encoding: "utf-8",
    timeout: 20000,
  });
  if (process.status !== 0) {
    return process.stderr?.trim() || process.stdout?.trim() || "qmd update failed";
  }
  return process.stdout?.trim() || "qmd update completed";
}

function bootstrapAppDevSession() {
  if (appDevSessionBootstrapped) {
    return;
  }
  appDevSessionBootstrapped = true;

  const message =
    "接管 OpenClaw Web Console 的长期开发与维护。先读取 ~/.openclaw/workspace/apps/mission-control/OPENCLAW_INSTRUCTIONS.md、USER_MANUAL.md、AGENTS.md、agent-routing.config.json。你的角色是主编排者，不是单一工程师。持续处理这个应用的反馈、自进化任务、UI 改进、SOP 执行链修复，并把任务分配给最合适的 agents。";

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
      "120",
    ],
    {
      detached: true,
      stdio: "ignore",
    },
  );
  child.unref();
}

function feedbackSuggestions(feedback: string, task: AgentTask, sentiment: string) {
  const normalized = feedback.toLowerCase();
  const suggestions: string[] = [];

  if (sentiment === "negative") {
    suggestions.push("Re-check the SOP defaults and required input schema before the next run.");
    suggestions.push("Update the workflow output contract so the final artifact is easier to inspect.");
  }

  if (normalized.includes("列") || normalized.includes("字段") || normalized.includes("column")) {
    suggestions.push("Adjust the exported schema or column mapping for this SOP.");
  }
  if (normalized.includes("路径") || normalized.includes("目录") || normalized.includes("path")) {
    suggestions.push("Refine default output path and artifact reveal behavior.");
  }
  if (normalized.includes("摘要") || normalized.includes("总览") || normalized.includes("summary")) {
    suggestions.push("Add or improve a summary block in the final artifact or dashboard preview.");
  }
  if (normalized.includes("默认") || normalized.includes("default")) {
    suggestions.push("Revisit the default behavior for this SOP so it matches the user's preferred delivery flow.");
  }
  if (normalized.includes("格式") || normalized.includes("style") || normalized.includes("excel")) {
    suggestions.push("Tune the final writer or formatter for this artifact type.");
  }
  if (normalized.includes("不对") || normalized.includes("错误") || normalized.includes("wrong")) {
    suggestions.push("Add a runtime validation checkpoint before marking the task completed.");
  }
  if (
    sentiment === "positive" &&
    suggestions.length === 0 &&
    (normalized.includes("很好") || normalized.includes("满意") || normalized.includes("good"))
  ) {
    suggestions.push("Promote this run as a confirmed reference case in the knowledge base.");
  }

  if (suggestions.length === 0) {
    suggestions.push("Record this feedback as a reusable rule for future runs of the same SOP.");
  }

  suggestions.push(`Keep feedback linked to node ${task.nodeId} so future retrieval can match this SOP.`);
  return [...new Set(suggestions)];
}

async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());
  app.use("/exports", express.static(path.join(process.cwd(), "exports")));

  let clients: express.Response[] = [];

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      heartbeat: buildHeartbeatPayload(),
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
  }, HEARTBEAT_INTERVAL_MS);

  app.get("/api/v1/stream-vibe", (_req, res) => {
    res.redirect(307, "/api/v1/stream");
  });

  app.get("/api/v1/skill-tree", (_req, res) => {
    res.json({
      nodes: getSkillTreeNodes(),
      source: "openclaw-workspace",
    });
  });

  app.get("/api/v1/doc", (req, res) => {
    const rawPath =
      typeof req.query.path === "string" ? req.query.path.trim() : "";
    if (!rawPath) {
      return res.status(400).send("Missing path");
    }

    if (!isAllowedDocPath(rawPath)) {
      return res.status(403).send("Path not allowed");
    }

    if (!fs.existsSync(rawPath) || !fs.statSync(rawPath).isFile()) {
      return res.status(404).send("Document not found");
    }

    const content = fs.readFileSync(rawPath, "utf-8");
    const title = path.basename(rawPath);
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

  app.get("/api/v1/qmd-doc", (req, res) => {
    const ref = typeof req.query.ref === "string" ? req.query.ref.trim() : "";
    if (!ref) {
      return res.status(400).send("Missing ref");
    }

    const process = spawnSync("qmd", ["get", ref], {
      encoding: "utf-8",
      timeout: 15000,
    });

    if (process.status !== 0) {
      return res.status(404).send("QMD document not found");
    }

    const content = process.stdout || process.stderr || "";
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
    const targetPath =
      typeof req.body?.path === "string" ? req.body.path.trim() : "";
    const reveal = Boolean(req.body?.reveal);

    if (!targetPath) {
      return res.status(400).json({ error: "path is required" });
    }
    if (!isAllowedFileActionPath(targetPath)) {
      return res.status(403).json({ error: "Path not allowed" });
    }
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const args =
      reveal && fs.statSync(targetPath).isFile()
        ? ["-R", targetPath]
        : [targetPath];
    const process = spawnSync("open", args, {
      encoding: "utf-8",
      timeout: 10000,
    });

    if (process.status !== 0) {
      return res.status(500).json({
        error: process.stderr?.trim() || process.stdout?.trim() || "Failed to open file",
      });
    }

    return res.json({ success: true });
  });

  app.get("/api/v1/control-plane/state", (_req, res) => {
    res.json(buildControlPlaneState());
  });

  app.post("/api/v1/control-plane/asset-root", (req, res) => {
    const nextPath =
      typeof req.body?.path === "string" ? req.body.path.trim() : "";

    if (!nextPath) {
      return res.status(400).json({ error: "path is required" });
    }

    const resolved = path.resolve(nextPath);
    if (!path.isAbsolute(resolved)) {
      return res.status(400).json({ error: "Asset root must be an absolute path" });
    }

    updateAgentOsConfig({ assetRootPath: resolved });
    return res.json({
      success: true,
      assetRoot: buildAssetRootState(),
    });
  });

  app.post("/api/v1/control-plane/asset-intake", (req, res) => {
    const targetDir =
      typeof req.body?.targetDir === "string" ? req.body.targetDir.trim() : "";
    const archiveRule =
      typeof req.body?.archiveRule === "string" ? req.body.archiveRule.trim() : "";
    const action =
      typeof req.body?.action === "string" ? req.body.action.trim() : "full";

    if (!targetDir) {
      return res.status(400).json({ error: "targetDir is required" });
    }

    const resolvedTargetDir = path.resolve(targetDir);
    const assetRootState = buildAssetRootState();
    const primaryConfig = readAgentOsConfig();
    const insideManagedRoots =
      isPathInsideLegacyRoots(resolvedTargetDir) ||
      (assetRootState.configured &&
        isPathInsideAssetRoot(resolvedTargetDir, primaryConfig));

    if (!insideManagedRoots) {
      return res.status(400).json({
        error:
          "Target directory must be inside the configured asset root or a legacy mapped workspace root.",
      });
    }

    const queueTask = (nodeId: string, command: string, inputValues: Record<string, string>) => {
      const task = createTask(nodeId, command, {
        inputValues,
        sourcePath: path.join(process.cwd(), "scripts"),
        sourceType: "content-system",
        targetDir: resolvedTargetDir,
        archiveRule,
        assetRootPath: assetRootState.path,
        requiredSkills: [],
      });
      commandQueue.push(task);
      persistTask(task);
      broadcast(clients, {
        type: "task-queued",
        payload: task,
      });
      return task;
    };

    const queuedTasks: AgentTask[] = [];

    if (action === "organize" || action === "full") {
      queuedTasks.push(
        queueTask(
          "project_file_organize",
          `python3 ${path.join(process.cwd(), "scripts", "run_project_file_organize.py")} --target-dir <目标目录> --rule <归档规则说明>`,
          {
            目标目录: resolvedTargetDir,
            归档规则说明: archiveRule,
          },
        ),
      );
    }

    if (action === "index" || action === "full") {
      queuedTasks.push(
        queueTask(
          "project_file_index",
          `python3 ${path.join(process.cwd(), "scripts", "run_project_file_index.py")} --target-dir <目标目录>`,
          {
            目标目录: resolvedTargetDir,
          },
        ),
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
          followUp: action === "full"
            ? {
                queued: true,
                reason: "Archive and index were queued together for the same directory.",
              }
            : undefined,
        },
        {
          asset: {
            configured: assetRootState.configured,
            path: assetRootState.path,
          },
        },
      )),
    });
  });

  app.post("/api/v1/heartbeat", (req, res) => {
    const nextAgentId =
      typeof req.body?.agentId === "string" && req.body.agentId.trim()
        ? req.body.agentId.trim()
        : agentState.id;

    agentState = {
      id: nextAgentId ?? "openclaw-agent",
      online: true,
      lastSeenAt: now(),
    };

    emitHeartbeat(clients);
    res.json({ success: true });
  });

  app.post("/api/v1/knowledge/ingest", (req, res) => {
    const action = req.body?.action === "delete" ? "delete" : "upsert";
    const payload = req.body?.payload as KnowledgeItem | undefined;

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
      payload,
    });

    res.json({ success: true });
  });

  app.post("/api/v1/node-update", (req, res) => {
    const { nodeId, status, drawerContent } = req.body ?? {};

    if (!nodeId || !status) {
      return res
        .status(400)
        .json({ error: "nodeId and status are required" });
    }

    broadcast(clients, {
      type: "node-update",
      nodeId,
      status,
      drawerContent,
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
      requiredSkills,
    } = req.body ?? {};

    if (!nodeId || !command) {
      return res
        .status(400)
        .json({ error: "nodeId and command are required" });
    }

    const task = createTask(nodeId, command, {
      inputValues:
        inputValues && typeof inputValues === "object" ? inputValues : {},
      sourcePath: typeof sourcePath === "string" ? sourcePath : undefined,
      sourceType: sourceType as SkillNode["sourceType"] | undefined,
      inputSchema: Array.isArray(inputSchema)
        ? (inputSchema as NonNullable<SkillNode["drawerContent"]>["inputs"])
        : [],
      route:
        route && typeof route === "object"
          ? (route as NonNullable<SkillNode["drawerContent"]>["route"])
          : undefined,
      requiredSkills: Array.isArray(requiredSkills)
        ? (requiredSkills as SkillModule[])
        : [],
      targetDir:
        inputValues && typeof inputValues === "object" && typeof inputValues["目标目录"] === "string"
          ? path.resolve(inputValues["目标目录"])
          : undefined,
      archiveRule:
        inputValues && typeof inputValues === "object" && typeof inputValues["归档规则说明"] === "string"
          ? inputValues["归档规则说明"]
          : undefined,
      assetRootPath: buildAssetRootState().path,
    });
    commandQueue.push(task);
    persistTask(task);

    broadcast(clients, {
      type: "task-queued",
      payload: task,
    });
    emitHeartbeat(clients);

    res.json({
      success: true,
      message: `Execution command queued for ${nodeId}`,
      task,
    });
  });

  app.post("/api/v1/bundles/export", (req, res) => {
    const nodeId =
      typeof req.body?.nodeId === "string" ? req.body.nodeId.trim() : "";
    const exportAll = Boolean(req.body?.all);

    if (!nodeId && !exportAll) {
      return res.status(400).json({ error: "nodeId or all is required" });
    }

    const args = [
      "scripts/export_sop_bundle.py",
      "--output-dir",
      path.join(process.cwd(), "exports", "bundles"),
      "--base-url",
      `http://127.0.0.1:${port}`,
      "--json",
    ];

    if (exportAll) {
      args.push("--all");
    } else {
      args.push("--node-id", nodeId);
    }

    const exportProcess = spawnSync("python3", args, {
      cwd: process.cwd(),
      encoding: "utf-8",
      timeout: 60000,
    });

    if (exportProcess.status !== 0) {
      return res.status(500).json({
        error:
          exportProcess.stderr?.trim() ||
          exportProcess.stdout?.trim() ||
          "Bundle export failed",
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
    const requestedAgentId =
      typeof req.body?.agentId === "string" && req.body.agentId.trim()
        ? req.body.agentId.trim()
        : "openclaw-agent";

    agentState = {
      id: requestedAgentId,
      online: true,
      lastSeenAt: now(),
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
        nextAction: "Wait for execution output or inspect blockers if the claim stalls.",
      };
      persistTask(task);

      broadcast(clients, {
        type: "task-claimed",
        payload: task,
      });
    }

    emitHeartbeat(clients);
    res.json({ success: true, task });
  });

  app.post("/api/v1/agent/task-update", (req, res) => {
    const payload = (req.body ?? {}) as TaskUpdateRequest;
    if (!payload.taskId || !payload.status) {
      return res
        .status(400)
        .json({ error: "taskId and status are required" });
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
    task.artifactRefs = Array.isArray(payload.artifactRefs)
      ? payload.artifactRefs
      : task.artifactRefs;
    task.blocker =
      payload.blocker && typeof payload.blocker === "object"
        ? payload.blocker
        : task.blocker;
    task.decisionState =
      payload.decisionState && typeof payload.decisionState === "object"
        ? payload.decisionState
        : task.decisionState;
    persistTask(normalizeTask(task));

    if (Array.isArray(payload.runtimeSkillsUsed) && payload.runtimeSkillsUsed.length > 0) {
      recordRuntimeSkillEvidence(task.nodeId, payload.runtimeSkillsUsed);
    }

    if (payload.nodeStatus) {
      broadcast(clients, {
        type: "node-update",
        nodeId: task.nodeId,
        status: payload.nodeStatus,
        drawerContent: payload.drawerContent,
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
        payload: payload.knowledgePayload,
      });
    }

    broadcast(clients, {
      type: "task-updated",
      payload: task,
    });
    emitHeartbeat(clients);

    res.json({ success: true, task });
  });

  app.post("/api/v1/task-feedback", (req, res) => {
    const taskId =
      typeof req.body?.taskId === "string" ? req.body.taskId.trim() : "";
    const sentiment =
      typeof req.body?.sentiment === "string" ? req.body.sentiment.trim() : "note";
    const feedback =
      typeof req.body?.feedback === "string" ? req.body.feedback.trim() : "";

    if (!taskId || !feedback) {
      return res.status(400).json({ error: "taskId and feedback are required" });
    }

    const task =
      commandQueue.find((item) => item.id === taskId) ??
      readTaskHistory().find((item) => item.id === taskId);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const feedbackRoot = path.join(workspaceRoot, "agents", "knowledge", "feedback");
    const evolutionRoot = path.join(workspaceRoot, "agents", "knowledge", "evolution");
    ensureDir(feedbackRoot);
    ensureDir(evolutionRoot);

    const suggestions = feedbackSuggestions(feedback, task, sentiment);
    const feedbackPath = path.join(feedbackRoot, `${task.id}.md`);
    const evolutionPath = path.join(evolutionRoot, `${task.id}.md`);
    const artifactPaths = Array.isArray(req.body?.artifacts)
      ? (req.body.artifacts as string[]).filter((item) => typeof item === "string" && item.startsWith("/"))
      : [];

    const feedbackMarkdown = [
      "---",
      `id: ${task.id}`,
      "type: user-feedback",
      "evidence: human-feedback",
      `node_id: ${task.nodeId}`,
      `task_status: ${task.status}`,
      `sentiment: ${sentiment}`,
      `updated_at: ${new Date().toISOString()}`,
      "---",
      "",
      `# ${task.nodeLabel} 用户反馈`,
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
      ...(artifactPaths.length > 0 ? artifactPaths.map((item) => `- ${item}`) : ["- None"]),
      "",
      "## Result Detail",
      "",
      "```text",
      (task.resultDetail ?? "").slice(0, 6000),
      "```",
      "",
    ].join("\n");

    const evolutionMarkdown = [
      "---",
      `id: evo-${task.id}`,
      "type: evolution-note",
      "evidence: human-feedback",
      `node_id: ${task.nodeId}`,
      `updated_at: ${new Date().toISOString()}`,
      "---",
      "",
      `# ${task.nodeLabel} 自进化建议`,
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
      "",
    ].join("\n");

    fs.writeFileSync(feedbackPath, feedbackMarkdown, "utf-8");
    fs.writeFileSync(evolutionPath, evolutionMarkdown, "utf-8");

    const knowledgePayload: KnowledgeItem = {
      id: `kb-feedback-${task.id}`,
      evidenceLevel: "runtime",
      knowledgeType: "feedback",
      sourceKind: "feedback",
      updatedAt: new Date().toISOString(),
      human: {
        title: `${task.nodeLabel} Feedback`,
        summary: feedback.slice(0, 160),
        content_md: feedbackMarkdown,
        tags: ["feedback", sentiment, task.nodeId],
        domain: "User Feedback",
        platform: "OpenClaw Evolution",
        links: [
          { title: "Feedback Note", url: `/api/v1/doc?path=${encodeURIComponent(feedbackPath)}` },
          { title: "Evolution Note", url: `/api/v1/doc?path=${encodeURIComponent(evolutionPath)}` },
        ],
        examples: suggestions.slice(0, 3).map((item, index) => ({
          title: `Suggestion ${index + 1}`,
          summary: item,
        })),
      },
      machine: {
        intent: "task_feedback",
        entities: {
          taskId: task.id,
          nodeId: task.nodeId,
          sentiment,
        },
        steps: suggestions,
        commands: [],
        constraints: [],
      },
    };

    upsertKnowledge(knowledgePayload);
    broadcast(clients, {
      type: "knowledge",
      action: "upsert",
      payload: knowledgePayload,
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
      artifactPaths,
    });
    evolutionTask.nodeLabel = `自进化：${task.nodeLabel}`;
    evolutionTask.familyId = task.familyId || taskFamilyId(task.nodeId);
    evolutionTask.familyLabel = task.familyLabel || task.nodeLabel;
    commandQueue.push(evolutionTask);
    persistTask(evolutionTask);
    broadcast(clients, {
      type: "task-queued",
      payload: evolutionTask,
    });
    emitHeartbeat(clients);

    return res.json({
      success: true,
      summary: `Feedback saved for ${task.nodeLabel} and evolution task queued.`,
      feedbackPath,
      evolutionPath,
      suggestions,
      evolutionTaskId: evolutionTask.id,
      qmdUpdate,
    });
  });

  app.post("/api/v1/knowledge/search", (req, res) => {
    const { query, domain, platform } = req.body ?? {};
    const qmdResults = searchQmdKnowledge(query);
    res.json({
      results: [...searchKnowledge(query, domain, platform), ...qmdResults],
    });
  });

  app.get("/api/v1/task-history", (req, res) => {
    const offsetRaw = typeof req.query.offset === "string" ? parseInt(req.query.offset, 10) : 0;
    const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : DEFAULT_HISTORY_GROUP_LIMIT;
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 20) : DEFAULT_HISTORY_GROUP_LIMIT;

    const persisted = readTaskHistory().filter(
      (task) => task.status === "completed" || task.status === "failed",
    );
    const liveRecent = commandQueue.filter(
      (task) => task.status === "completed" || task.status === "failed",
    );
    const merged = [...persisted, ...liveRecent].filter(
      (task, index, array) => array.findIndex((item) => item.id === task.id) === index,
    );
    const groups = groupTaskHistory(merged);
    const sliced = groups.slice(offset, offset + limit);
    const nextOffset = offset + limit < groups.length ? offset + limit : null;

    res.json({
      groups: sliced,
      nextOffset,
      hasMore: nextOffset !== null,
      totalGroups: groups.length,
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log("OpenClaw broker endpoints ready:");
    console.log("  UI SSE:          GET  /api/v1/stream");
    console.log("  Agent poll:      POST /api/v1/agent/poll");
    console.log("  Agent task sync: POST /api/v1/agent/task-update");
    console.log(`  App dev session: ${APP_DEV_SESSION_ID}`);
    bootstrapAppDevSession();
  });
}

startServer();
