import express from "express";
import { spawn, spawnSync } from "node:child_process";
import { createServer as createViteServer } from "vite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
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
import { getRepoRoot, getRuntimeRoot } from "./src/server/workspaceTopology";
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
  ShortVideoFactoryState,
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
const workspaceRoot = getRepoRoot();
const runtimeRoot = getRuntimeRoot();
const localPackageRegistryScript = path.join(process.cwd(), "scripts", "local_package_registry.py");
const localPackageStagingRoot = path.join(runtimeRoot, "staged", "community-package-staging");
const taskHistoryPath = path.join(runtimeRoot, "agent", "task-history.json");
const inputProfilesPath = path.join(runtimeRoot, "agent", "input-profiles.json");
const decisionStatePath = path.join(runtimeRoot, "agent", "decision-state.json");
const libraryRoot = path.resolve(readAgentOsConfig().assetRootPath);
const docRoots = [
  path.join(homeDir, ".openclaw"),
  libraryRoot,
  ...getSkillSourceRoots(),
  process.cwd(),
];
const fileActionRoots = [
  ...docRoots,
  path.join(homeDir, "Desktop"),
  path.join(homeDir, "Downloads"),
];
const knowledgeCasesRoot = path.join(runtimeRoot, "knowledge", "cases");
const runtimeLessonsRoot = path.join(runtimeRoot, "knowledge", "runtime-lessons");
const legacyAssetRoots = [path.join(workspaceRoot, "content_system")];
const DEFAULT_SHORT_VIDEO_SERIES = "AI内容系统";
const DEFAULT_SHORT_VIDEO_INSTANCE_SUFFIX = "短视频对标试点";
const DEFAULT_SHORT_VIDEO_MIN_SAMPLE_SIZE = 3;
const DEFAULT_SHORT_VIDEO_SAMPLE_SIZE = 5;
const NOTEBOOKLM_ACCOUNT_MAP = path.join(path.resolve(readAgentOsConfig().assetRootPath), "mappings", "notebooklm-account-map.json");
const DEFAULT_STORAGE_SERIES = "AI内容系统";
const DEFAULT_STORAGE_INSTANCE_SUFFIX = "存储与检索";
const STORAGE_PROJECT_MEMORY_FILE = "project-memory.json";
const geminiConsentPath = path.join(
  homeDir,
  "Library",
  "Application Support",
  "baoyu-skills",
  "gemini-web",
  "consent.json",
);
const notebookLmStatePath = path.join(
  homeDir,
  ".agents",
  "skills",
  "notebooklm",
  "data",
  "browser_state",
  "state.json",
);
const notebookLmValidationPath = path.join(
  homeDir,
  ".agents",
  "skills",
  "notebooklm",
  "data",
  "validation.json",
);
const shortVideoNodeLabels: Record<string, string> = {
  short_video_account_research: "运行账号研究",
  short_video_creative_brief: "生成 Creative Brief",
  short_video_director_production: "启动导演与生产链",
  short_video_insight_capture: "收藏视频洞察",
  notebooklm_account_enhance: "NotebookLM 增强归纳",
};

const runtimeKnowledgeDb: KnowledgeItem[] = [...seedKnowledgeBase];
const commandQueue: AgentTask[] = [];
let agentState: AgentStatus = {
  id: null,
  online: false,
  lastSeenAt: null,
};
let appDevSessionBootstrapped = false;
let residentAgentProcess: ReturnType<typeof spawn> | null = null;
let residentAgentRestartTimer: NodeJS.Timeout | null = null;
let residentAgentStartGracePassed = false;

const RESIDENT_AGENT_START_GRACE_MS = 8000;
const RESIDENT_AGENT_RESTART_DELAY_MS = 4000;

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
      OPENCLAW_AGENT_ID: process.env.OPENCLAW_AGENT_ID || "openclaw-resident-agent",
    },
    stdio: ["ignore", "pipe", "pipe"],
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
  if (process.env.OPENCLAW_DISABLE_AGENT_AUTOSTART === "1") {
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

function shortVideoDefaultInstance() {
  const stamp = new Date().toISOString().slice(0, 7);
  return `${stamp}__${DEFAULT_SHORT_VIDEO_INSTANCE_SUFFIX}`;
}

function storageDefaultInstance() {
  const stamp = new Date().toISOString().slice(0, 7);
  return `${stamp}__${DEFAULT_STORAGE_INSTANCE_SUFFIX}`;
}

function sanitizeSegment(value: string, fallback = "untitled") {
  const normalized = value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^0-9A-Za-z\u4e00-\u9fff._-]+/g, "")
    .replace(/^[_\-.]+|[_\-.]+$/g, "");
  return normalized.slice(0, 80) || fallback;
}

function accountFolderName(accountName: string, accountHandle?: string) {
  const primary = sanitizeSegment(accountName || accountHandle || "未命名账号", "未命名账号");
  const handle = sanitizeSegment(accountHandle ?? "", "");
  return handle && handle !== primary ? `${primary}__${handle}` : primary;
}

function detectShortVideoPlatform(url: string) {
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
  const root = path.resolve(readAgentOsConfig().assetRootPath);
  const instance = storageDefaultInstance();
  return {
    assetBase: path.join(root, "assets", DEFAULT_STORAGE_SERIES, instance),
    knowledgeBase: path.join(root, "knowledge", "projects", DEFAULT_STORAGE_SERIES, instance),
  };
}

function storageImportRoot() {
  return path.join(storageSeriesPaths().assetBase, "intake", "storage-retrieval");
}

function storageProjectMemoryPath() {
  return path.join(storageSeriesPaths().assetBase, "mappings", STORAGE_PROJECT_MEMORY_FILE);
}

function classifyStorageFileType(targetPath: string, isDirectory = false) {
  if (isDirectory) {
    return "directory";
  }
  const ext = path.extname(targetPath).toLowerCase();
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

function decodeImportTextSample(fileName: string, contentBase64?: string) {
  if (!contentBase64) {
    return "";
  }
  const fileType = classifyStorageFileType(fileName, false);
  if (!["knowledge", "data", "document"].includes(fileType)) {
    return "";
  }
  try {
    return Buffer.from(contentBase64, "base64").toString("utf-8").slice(0, 6000);
  } catch {
    return "";
  }
}

function buildStorageMemoryTokens(source: string, textSample = "") {
  const sourceBase = path.basename(source).toLowerCase();
  const rawTokens = [
    sourceBase,
    ...sourceBase.split(/[_\-\s.]+/g),
    ...((textSample.toLowerCase().match(/[a-z0-9\u4e00-\u9fff]{4,}/g) ?? []) as string[]),
  ];
  return [...new Set(rawTokens.map((item) => item.trim()).filter((item) => item.length >= 4))].slice(0, 24);
}

function loadStorageProjectMemory() {
  const memoryPath = storageProjectMemoryPath();
  if (!fs.existsSync(memoryPath)) {
    return { rules: [] as Array<{
      token: string;
      projectFolder: string;
      workflow: string;
      stage: string;
      sourceKind: "path" | "link" | "upload";
      createdAt: string;
    }> };
  }
  try {
    return JSON.parse(fs.readFileSync(memoryPath, "utf-8")) as {
      rules: Array<{
        token: string;
        projectFolder: string;
        workflow: string;
        stage: string;
        sourceKind: "path" | "link" | "upload";
        createdAt: string;
      }>;
    };
  } catch {
    return { rules: [] };
  }
}

function saveStorageProjectMemory(memory: ReturnType<typeof loadStorageProjectMemory>) {
  const targetPath = storageProjectMemoryPath();
  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, JSON.stringify(memory, null, 2), "utf-8");
}

function matchStorageProjectMemory(source: string, textSample = "") {
  const memory = loadStorageProjectMemory();
  const tokens = buildStorageMemoryTokens(source, textSample);
  return memory.rules.find((rule) => tokens.includes(rule.token)) ?? null;
}

function rememberStorageClassification(input: {
  source: string;
  textSample?: string;
  sourceKind: "path" | "link" | "upload";
  projectFolder: string;
  workflow: string;
  stage: string;
}) {
  const memory = loadStorageProjectMemory();
  const createdAt = new Date().toISOString();
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
        createdAt,
      });
    }
  }
  saveStorageProjectMemory(memory);
}

function inferStorageProjectFolder(source: string, textSample = "") {
  const corpus = `${source}\n${textSample}`.toLowerCase();
  if (
    corpus.includes("agent system") ||
    corpus.includes("agent操作系统") ||
    corpus.includes("architecture draft") ||
    corpus.includes("system architecture") ||
    corpus.includes("openclaw") ||
    corpus.includes("mission-control")
  ) {
    return "Agent操作系统";
  }
  if (
    corpus.includes("xiaohongshu") ||
    corpus.includes("xhs_") ||
    corpus.includes("comment") ||
    corpus.includes("comments.xlsx") ||
    corpus.includes("小红书")
  ) {
    return "小红书内容研究";
  }
  if (
    corpus.includes("douyin") ||
    corpus.includes("抖音") ||
    corpus.includes("short video") ||
    corpus.includes("短视频")
  ) {
    return "短视频内容系统";
  }
  if (
    corpus.includes("notebooklm") ||
    corpus.includes("gemini") ||
    corpus.includes("ai ")
  ) {
    return "AI工具研究";
  }
  return "未分类导入";
}

function inferStorageWorkflow(source: string, textSample = "") {
  const corpus = `${source}\n${textSample}`.toLowerCase();
  if (corpus.includes("architecture") || corpus.includes("系统架构") || corpus.includes("draft")) {
    return "architecture";
  }
  if (corpus.includes("comment") || corpus.includes("comments") || corpus.includes("评论")) {
    return "comment-analysis";
  }
  if (corpus.includes("report") || corpus.includes("分析")) {
    return "analysis";
  }
  if (corpus.includes("sop")) {
    return "workflow-sop";
  }
  return "reference";
}

function inferStorageStage(source: string, textSample = "") {
  const corpus = `${source}\n${textSample}`.toLowerCase();
  if (corpus.includes("draft") || corpus.includes("草稿")) {
    return "draft";
  }
  if (corpus.includes("final") || corpus.includes("正式")) {
    return "final";
  }
  if (corpus.includes("report") || corpus.includes("analysis") || corpus.includes("研究")) {
    return "research";
  }
  if (corpus.includes("runtime")) {
    return "runtime";
  }
  return "reference";
}

function storageDestinationForImport(input: {
  source: string;
  fileType: string;
  projectFolder: string;
  workflow: string;
  stage: string;
  isDirectory?: boolean;
}) {
  const assetBase = storageSeriesPaths().assetBase;
  const projectRoot = path.join(assetBase, "projects", input.projectFolder);
  if (input.isDirectory) {
    return path.join(projectRoot, "incoming", "directories", sanitizeSegment(path.basename(input.source), "directory"));
  }
  if (input.fileType === "image") {
    return path.join(projectRoot, "raw", "images", sanitizeSegment(path.basename(input.source), "image"));
  }
  if (input.fileType === "video") {
    return path.join(projectRoot, "raw", "videos", sanitizeSegment(path.basename(input.source), "video"));
  }
  if (input.fileType === "data") {
    return path.join(projectRoot, "research", input.stage, sanitizeSegment(path.basename(input.source), "data"));
  }
  if (input.fileType === "document") {
    return path.join(projectRoot, "research", input.stage, sanitizeSegment(path.basename(input.source), "document"));
  }
  if (input.fileType === "knowledge") {
    return path.join(projectRoot, "references", input.workflow, input.stage, sanitizeSegment(path.basename(input.source), "note"));
  }
  return path.join(projectRoot, "misc", input.stage, sanitizeSegment(path.basename(input.source), "file"));
}

function normalizeStorageWorkflow(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized || "reference";
}

function normalizeStorageStage(value: string) {
  const normalized = value.trim().toLowerCase();
  const allowed = new Set(["inbox", "draft", "research", "reference", "runtime", "final"]);
  return allowed.has(normalized) ? normalized : "reference";
}

function normalizeStorageProjectFolder(value: string) {
  return sanitizeSegment(value, "未分类导入");
}

function normalizeClassifiedAsToFileType(value: string) {
  if (value === "link-video") return "video";
  if (value === "link-reference") return "knowledge";
  return value;
}

function storageClassificationSummary(input: {
  source: string;
  sourceKind: "path" | "link" | "upload";
  fileType: string;
  textSample?: string;
  isDirectory?: boolean;
}) {
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
    isDirectory: input.isDirectory,
  });
  const confidence =
    projectFolder === "未分类导入" || workflow === "reference"
      ? "low"
      : stage === "reference"
        ? "medium"
        : "high";
  return {
    projectFolder,
    workflow,
    stage,
    destination,
    confidence,
    matchedByMemory: Boolean(memoryRule),
  };
}

function storageBucketForType(type: string) {
  if (type === "image") return "assets/raw/images";
  if (type === "video") return "assets/raw/videos";
  if (type === "document") return "assets/research/documents";
  if (type === "knowledge") return "assets/references/text";
  if (type === "data") return "assets/references/data";
  if (type === "directory") return "reference-only/directory";
  return "assets/misc";
}

function storageConfidenceForType(type: string) {
  if (type === "image" || type === "video" || type === "directory") {
    return "high";
  }
  if (type === "document") {
    return "medium";
  }
  return "low";
}

function isTextSearchableAsset(targetPath: string) {
  const ext = path.extname(targetPath).toLowerCase();
  return [".md", ".txt", ".json", ".csv", ".yaml", ".yml"].includes(ext);
}

function inferProjectSeriesFromPath(targetPath: string) {
  const normalized = targetPath.split(path.sep);
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

function inferPlatformFromPath(targetPath: string) {
  const lower = targetPath.toLowerCase();
  if (lower.includes("douyin")) return "douyin";
  if (lower.includes("xiaohongshu")) return "xiaohongshu";
  if (lower.includes("mission-control")) return "mission-control";
  return "";
}

function searchAssetEntries(options: {
  query: string;
  type: string;
  platform: string;
  projectSeries?: string;
}) {
  const assetRoot = path.join(path.resolve(readAgentOsConfig().assetRootPath), "assets");
  if (!fs.existsSync(assetRoot)) {
    return [];
  }
  const results: Array<Record<string, string>> = [];
  const normalizedQuery = options.query.toLowerCase();
  const walk = (dirPath: string) => {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path.join(dirPath, entry.name);
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
          searchCorpus.push(fs.readFileSync(fullPath, "utf-8").slice(0, 5000));
        } catch {
          // ignore unreadable text files
        }
      }
      const matches = searchCorpus.some((value) => value.toLowerCase().includes(normalizedQuery));
      if (matches) {
        const stats = fs.statSync(fullPath);
        results.push({
          id: `asset-${fullPath}`,
          title: entry.name,
          kind: "asset",
          fileType,
          resultClass: fullPath.includes(`${path.sep}deliverables${path.sep}`)
            ? "deliverable"
            : fullPath.includes(`${path.sep}raw${path.sep}`)
              ? "raw"
              : "asset",
          path: fullPath,
          summary: isDirectory ? "目录结果" : fullPath,
          updatedAt: new Date(stats.mtimeMs).toISOString(),
          projectSeries,
          platform,
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

function searchKnowledgeEntries(options: {
  query: string;
  platform: string;
  projectSeries?: string;
}) {
  const normalizedQuery = options.query.trim().toLowerCase();
  const wantsTaskLogs =
    normalizedQuery.includes("task_") ||
    normalizedQuery.includes("runtime") ||
    normalizedQuery.includes("日志") ||
    normalizedQuery.includes("log") ||
    normalizedQuery.includes("教训") ||
    normalizedQuery.includes("lesson") ||
    normalizedQuery.includes("反馈");
  const results = searchKnowledge(options.query)
    .map((item) => {
      const docLink = item.human.links?.find((link) => link.url.startsWith("/api/v1/doc?path="));
      const pathValue = docLink
        ? decodeURIComponent(docLink.url.replace("/api/v1/doc?path=", ""))
        : "";
      return {
        id: item.id,
        title: item.human.title,
        kind: "knowledge",
        fileType: "knowledge",
        resultClass:
          item.knowledgeType === "runtime-lesson" ||
          pathValue.replace(/\\/g, "/").includes("/agents/knowledge/runtime-lessons/") ||
          pathValue.replace(/\\/g, "/").includes("/agents/knowledge/cases/task_")
            ? "runtime-log"
            : "knowledge",
        path: pathValue,
        summary: item.human.summary,
        updatedAt: item.updatedAt ?? "",
        projectSeries: inferProjectSeriesFromPath(pathValue),
        platform: item.human.platform.toLowerCase(),
        linkedKnowledgePath: pathValue || undefined,
        knowledgeType: item.knowledgeType ?? "",
      };
    })
    .filter((item) => {
      const normalizedPath = item.path.replace(/\\/g, "/");
      const isRuntimeLesson =
        item.knowledgeType === "runtime-lesson" ||
        normalizedPath.includes("/agents/knowledge/runtime-lessons/");
      const isTaskCase =
        normalizedPath.includes("/agents/knowledge/cases/task_") ||
        /^task_/i.test(normalizedPath.split("/").pop() ?? "");
      const isFeedbackLog =
        item.knowledgeType === "feedback" ||
        normalizedPath.includes("/agents/knowledge/feedback/");

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
    })
    .sort((a, b) => {
      const aPath = a.path.replace(/\\/g, "/");
      const bPath = b.path.replace(/\\/g, "/");
      const aScore =
        (aPath.includes("/knowledge/projects/") ? 0 : 1) +
        (aPath.includes("/assets/") ? 0 : 1);
      const bScore =
        (bPath.includes("/knowledge/projects/") ? 0 : 1) +
        (bPath.includes("/assets/") ? 0 : 1);
      if (aScore !== bScore) {
        return aScore - bScore;
      }
      return Date.parse(b.updatedAt || "") - Date.parse(a.updatedAt || "");
    });
  return results.slice(0, 60);
}

function newestFileMatching(dirPath: string, fileName: string) {
  if (!fs.existsSync(dirPath)) {
    return null;
  }
  let latest: { path: string; mtimeMs: number } | null = null;
  const walk = (currentDir: string) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile() || entry.name !== fileName) {
        continue;
      }
      const stats = fs.statSync(fullPath);
      if (!latest || stats.mtimeMs > latest.mtimeMs) {
        latest = { path: fullPath, mtimeMs: stats.mtimeMs };
      }
    }
  };
  walk(dirPath);
  return latest;
}

function artifactFromRecord(label: string, record: { path: string; mtimeMs: number } | null) {
  if (!record) {
    return null;
  }
  return {
    label,
    path: record.path,
    updatedAt: new Date(record.mtimeMs).toISOString(),
  };
}

function buildShortVideoFactoryState(): ShortVideoFactoryState {
  const libraryRootConfig = readAgentOsConfig().assetRootPath;
  const seriesRoot = path.join(libraryRootConfig, "assets", DEFAULT_SHORT_VIDEO_SERIES);
  const latestSampleBatch = artifactFromRecord(
    "样本批次",
    newestFileMatching(seriesRoot, "sample_manifest.json"),
  );
  const latestResearchBundle = artifactFromRecord(
    "账号研究包",
    newestFileMatching(seriesRoot, "account_research_bundle.json"),
  );
  const latestCreativeBrief = artifactFromRecord(
    "Creative Brief",
    newestFileMatching(seriesRoot, "creative_brief.json"),
  );
  const latestProductionPack = artifactFromRecord(
    "发布包",
    newestFileMatching(seriesRoot, "publish_pack__draft.md"),
  );
  const latestRoughCut = artifactFromRecord(
    "粗剪片",
    newestFileMatching(seriesRoot, "rough_cut.mp4"),
  );
  const latestInspirationRecord = artifactFromRecord(
    "收藏洞察",
    newestFileMatching(seriesRoot, "洞察记录__runtime.md"),
  );
  const latestNotebookSummary = artifactFromRecord(
    "NotebookLM 归纳",
    newestFileMatching(seriesRoot, "notebooklm_summary__runtime.md"),
  );
  const latestNotebookEnhancedBrief = artifactFromRecord(
    "NotebookLM 增强 Brief",
    newestFileMatching(seriesRoot, "notebooklm_enhanced_brief.json"),
  );
  const geminiConsentGranted =
    fs.existsSync(geminiConsentPath) &&
    (() => {
      try {
        const payload = JSON.parse(fs.readFileSync(geminiConsentPath, "utf-8")) as {
          accepted?: boolean;
          disclaimerVersion?: string;
        };
        return payload.accepted === true && payload.disclaimerVersion === "1.0";
      } catch {
        return false;
      }
    })();
  let notebooklmAvailable = fs.existsSync(notebookLmStatePath);
  if (fs.existsSync(notebookLmValidationPath)) {
    try {
      const validation = JSON.parse(fs.readFileSync(notebookLmValidationPath, "utf-8")) as {
        valid?: boolean;
      };
      if (validation.valid === false) {
        notebooklmAvailable = false;
      }
    } catch {
      // ignore invalid validation cache
    }
  }
  let notebookStatus: ShortVideoFactoryState["notebookStatus"] = notebooklmAvailable
    ? "missing"
    : "unavailable";
  let notebookSourceSyncAt: string | null = null;
  let notebookEnhancedBriefPath: string | null = latestNotebookEnhancedBrief?.path ?? null;

  if (fs.existsSync(NOTEBOOKLM_ACCOUNT_MAP)) {
    try {
      const mapping = JSON.parse(fs.readFileSync(NOTEBOOKLM_ACCOUNT_MAP, "utf-8")) as {
        accounts?: Record<string, { last_synced_at?: string }>;
      };
      const latestEntry = Object.values(mapping.accounts ?? {})
        .filter((entry) => entry.last_synced_at)
        .sort((a, b) => Date.parse(b.last_synced_at ?? "") - Date.parse(a.last_synced_at ?? ""))[0];
      if (latestEntry?.last_synced_at) {
        notebookSourceSyncAt = latestEntry.last_synced_at;
        notebookStatus = "sources_synced";
      }
    } catch {
      // ignore mapping parse failures
    }
  }
  if (latestNotebookSummary) {
    notebookStatus = "nblm_summary_ready";
  }
  if (latestNotebookEnhancedBrief) {
    notebookStatus = "enhanced_brief_ready";
  }

  const researchReady = Boolean(latestSampleBatch);
  const creativeReady =
    Boolean(latestResearchBundle) &&
    (!latestCreativeBrief ||
      Date.parse(latestCreativeBrief.updatedAt ?? "") < Date.parse(latestResearchBundle.updatedAt ?? ""));
  const productionReady =
    Boolean(latestCreativeBrief) &&
    (!latestProductionPack ||
      Date.parse(latestProductionPack.updatedAt ?? "") < Date.parse(latestCreativeBrief.updatedAt ?? ""));

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
        label: "账号试点",
        status: latestSampleBatch ? "completed" : "pending",
        detail: latestSampleBatch
          ? `已建立样本批次：${latestSampleBatch.path}`
          : "先导入一个 3-5 条样本的账号批次。",
      },
      {
        id: "research-to-production",
        label: "研究转生产",
        status: creativeReady ? "ready" : latestResearchBundle ? "completed" : researchReady ? "ready" : "pending",
        detail: latestResearchBundle
          ? "账号研究资产已生成，可以选择进入生产链。"
          : researchReady
            ? "样本批次已就绪，下一步运行账号研究。"
            : "等待样本批次建立。",
      },
      {
        id: "director-plan",
        label: "导演方案",
        status: productionReady ? "ready" : latestProductionPack ? "completed" : latestCreativeBrief ? "ready" : "pending",
        detail: latestCreativeBrief
          ? "Creative Brief 已生成，可以启动导演与生产链。"
          : "先完成 creative brief，再进入导演阶段。",
      },
      {
        id: "gemini-consent",
        label: "Gemini 增强分析",
        status: geminiConsentGranted ? "completed" : "blocked",
        detail: geminiConsentGranted
          ? "Gemini Web consent 已确认，可按需加入增强分析。"
          : "尚未完成 Gemini Web consent，增强视觉分析默认关闭。",
      },
      {
        id: "notebooklm",
        label: "NotebookLM 归纳",
        status: !notebooklmAvailable
          ? "blocked"
          : notebookStatus === "enhanced_brief_ready"
            ? "completed"
            : notebookStatus === "nblm_summary_ready" || notebookStatus === "sources_synced"
              ? "ready"
              : "pending",
        detail: !notebooklmAvailable
          ? "NotebookLM 当前不可用，但不影响基础链运行。"
          : notebookStatus === "enhanced_brief_ready"
            ? `增强版 brief 已生成：${latestNotebookEnhancedBrief?.path ?? ""}`
            : notebookStatus === "nblm_summary_ready"
              ? `NotebookLM 总结已生成：${latestNotebookSummary?.path ?? ""}`
              : notebookStatus === "sources_synced"
                ? `Notebook 与 source 已同步，最近同步时间：${notebookSourceSyncAt}`
                : "NotebookLM 当前可用，可作为账号级增强归纳层。"
      },
    ],
  };
}

function buildStorageImportItemSummary(input: {
  source: string;
  sourceKind: "path" | "link" | "upload";
  classifiedAs: string;
  projectFolder?: string;
  workflow?: string;
  stage?: string;
  matchedByMemory?: boolean;
  correctedManually?: boolean;
  targetBucket: string;
  action: "copied" | "referenced";
  confidence: "high" | "medium" | "low";
  storedAt?: string;
  warning?: string;
}) {
  return input;
}

function renderStorageImportNote(importedAt: string, summary: string, note: string, items: Array<ReturnType<typeof buildStorageImportItemSummary>>) {
  return [
    "# 导入记录",
    "",
    `- 时间：${importedAt}`,
    `- 摘要：${summary}`,
    note ? `- 备注：${note}` : "",
    "",
    "## 分类结果",
    "",
    ...items.map(
      (item) =>
        `- ${item.source} -> 项目:${item.projectFolder ?? "-"} / 流程:${item.workflow ?? "-"} / 阶段:${item.stage ?? "-"} / 类型:${item.classifiedAs} / 存放:${item.targetBucket}${item.correctedManually ? " / 人工纠偏" : ""}${item.matchedByMemory ? " / 记忆命中" : ""}${item.warning ? ` / ${item.warning}` : ""}`,
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

function moveFilePreservingContents(sourcePath: string, destinationPath: string) {
  if (sourcePath === destinationPath) {
    return destinationPath;
  }
  ensureDir(path.dirname(destinationPath));
  try {
    fs.renameSync(sourcePath, destinationPath);
  } catch {
    fs.copyFileSync(sourcePath, destinationPath);
    fs.unlinkSync(sourcePath);
  }
  return destinationPath;
}

function createStorageImportRecord(payload: {
  pathEntries: string[];
  linkEntries: string[];
  note?: string;
  files: Array<{ name: string; relativePath: string; contentBase64: string }>;
}) {
  const paths = storageSeriesPaths();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const importDir = path.join(storageImportRoot(), `import-${stamp}`);
  const filesDir = path.join(importDir, "files");
  ensureDir(filesDir);

  const items: Array<ReturnType<typeof buildStorageImportItemSummary>> = [];

  for (const file of payload.files) {
    const fileType = classifyStorageFileType(file.name, false);
    const textSample = decodeImportTextSample(file.name, file.contentBase64);
    const classification = storageClassificationSummary({
      source: file.relativePath,
      sourceKind: "upload",
      fileType,
      textSample,
    });
    const targetBucket = classification.destination.replace(`${storageSeriesPaths().assetBase}${path.sep}`, "");
    const destination = classification.destination;
    ensureDir(path.dirname(destination));
    fs.writeFileSync(destination, Buffer.from(file.contentBase64, "base64"));
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
        confidence: classification.confidence as "high" | "medium" | "low",
        storedAt: destination,
        warning: classification.confidence === "low"
          ? "系统能识别到大方向，但项目或阶段置信度较低；如果放得不对，请在任务记录里反馈。"
          : undefined,
      }),
    );
    rememberStorageClassification({
      source: file.relativePath,
      textSample,
      sourceKind: "upload",
      projectFolder: classification.projectFolder,
      workflow: classification.workflow,
      stage: classification.stage,
    });
  }

  for (const entry of payload.pathEntries) {
    const resolved = path.resolve(entry);
    if (!fs.existsSync(resolved)) {
      items.push(
        buildStorageImportItemSummary({
          source: entry,
          sourceKind: "path",
          classifiedAs: "missing",
          targetBucket: "invalid",
          action: "referenced",
          confidence: "low",
          warning: "路径不存在，未导入。",
        }),
      );
      continue;
    }
    const stats = fs.statSync(resolved);
    const fileType = classifyStorageFileType(resolved, stats.isDirectory());
    const textSample =
      !stats.isDirectory() && isTextSearchableAsset(resolved)
        ? fs.readFileSync(resolved, "utf-8").slice(0, 6000)
        : "";
    const classification = storageClassificationSummary({
      source: resolved,
      sourceKind: "path",
      fileType,
      textSample,
      isDirectory: stats.isDirectory(),
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
        targetBucket: classification.destination.replace(`${storageSeriesPaths().assetBase}${path.sep}`, ""),
        action: stats.isDirectory() ? "referenced" : "copied",
        confidence: classification.confidence as "high" | "medium" | "low",
        storedAt: stats.isDirectory() ? undefined : (() => {
          const destination = classification.destination;
          ensureDir(path.dirname(destination));
          fs.copyFileSync(resolved, destination);
          return destination;
        })(),
        warning: stats.isDirectory()
          ? "目录当前只登记引用，建议在“整理”里继续做归档与索引。"
          : classification.confidence === "low"
            ? "系统能识别到大方向，但项目或阶段置信度较低；如果放得不对，请在任务记录里反馈。"
            : undefined,
      }),
    );
    rememberStorageClassification({
      source: resolved,
      textSample,
      sourceKind: "path",
      projectFolder: classification.projectFolder,
      workflow: classification.workflow,
      stage: classification.stage,
    });
  }

  for (const entry of payload.linkEntries) {
    const platform = detectShortVideoPlatform(entry);
    const classification = storageClassificationSummary({
      source: entry,
      sourceKind: "link",
      fileType: platform !== "unknown" ? "video" : "knowledge",
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
        targetBucket: platform !== "unknown" ? "links/video-candidates" : classification.destination.replace(`${storageSeriesPaths().assetBase}${path.sep}`, ""),
        action: "referenced",
        confidence: platform !== "unknown" ? "medium" : (classification.confidence as "high" | "medium" | "low"),
        warning:
          platform !== "unknown"
            ? "已识别为短视频链接，可继续送去“收藏视频洞察”或短视频工厂。"
            : "普通链接已按参考资料工作流登记；如果归属不对，请在任务记录里反馈。",
      }),
    );
    rememberStorageClassification({
      source: entry,
      sourceKind: "link",
      projectFolder: classification.projectFolder,
      workflow: classification.workflow,
      stage: classification.stage,
    });
  }

  const importedAt = new Date().toISOString();
  const manifestPath = path.join(importDir, "import_manifest.json");
  const knowledgeNotePath = path.join(
    paths.knowledgeBase,
    "references",
    "storage-retrieval",
    `import-${stamp}`,
    "导入记录__runtime.md",
  );
  ensureDir(path.dirname(knowledgeNotePath));

  const summary = `已记录 ${items.length} 项导入内容，其中 ${items.filter((item) => item.action === "copied").length} 项已复制，${items.filter((item) => item.action === "referenced").length} 项按引用登记。`;

  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        importedAt,
        note: payload.note ?? "",
        summary,
        items,
      },
      null,
      2,
    ),
    "utf-8",
  );

  fs.writeFileSync(
    knowledgeNotePath,
    renderStorageImportNote(importedAt, summary, payload.note ?? "", items),
    "utf-8",
  );

  return {
    success: true,
    summary,
    manifestPath,
    knowledgeNotePath,
    importedAt,
    items,
  };
}

function fetchStorageImportRecent() {
  const root = storageImportRoot();
  if (!fs.existsSync(root)) {
    return [];
  }
  const manifests = newestFileMatching(root, "import_manifest.json");
  const records: Array<{
    id: string;
    importedAt: string;
    manifestPath: string;
    knowledgeNotePath?: string;
    summary: string;
  }> = [];
  const walk = (dirPath: string) => {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile() || entry.name !== "import_manifest.json") {
        continue;
      }
      try {
        const payload = JSON.parse(fs.readFileSync(fullPath, "utf-8")) as {
          importedAt?: string;
          summary?: string;
        };
        const dirName = path.basename(path.dirname(fullPath));
        const knowledgeNotePath = path.join(
          storageSeriesPaths().knowledgeBase,
          "references",
          "storage-retrieval",
          dirName,
          "导入记录__runtime.md",
        );
        records.push({
          id: dirName,
          importedAt: payload.importedAt ?? "",
          manifestPath: fullPath,
          knowledgeNotePath: fs.existsSync(knowledgeNotePath) ? knowledgeNotePath : undefined,
          summary: payload.summary ?? dirName,
        });
      } catch {
        // ignore invalid manifests
      }
    }
  };
  walk(root);
  return records.sort((a, b) => Date.parse(b.importedAt) - Date.parse(a.importedAt)).slice(0, 12);
}

function storageKnowledgeNotePathFromManifest(manifestPath: string) {
  const importId = path.basename(path.dirname(manifestPath));
  return path.join(
    storageSeriesPaths().knowledgeBase,
    "references",
    "storage-retrieval",
    importId,
    "导入记录__runtime.md",
  );
}

function reclassifyStorageImportItem(payload: {
  manifestPath: string;
  itemIndex: number;
  projectFolder: string;
  workflow: string;
  stage: string;
}) {
  const manifestPath = path.resolve(payload.manifestPath);
  if (!fs.existsSync(manifestPath)) {
    throw new Error("Import manifest not found");
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
    importedAt?: string;
    note?: string;
    summary?: string;
    items?: Array<ReturnType<typeof buildStorageImportItemSummary>>;
  };
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
    isDirectory: false,
  });

  let storedAt = item.storedAt;
  if (storedAt && fs.existsSync(storedAt)) {
    storedAt = moveFilePreservingContents(storedAt, destination);
  }

  const updatedItem = buildStorageImportItemSummary({
    ...item,
    projectFolder,
    workflow,
    stage,
    matchedByMemory: false,
    correctedManually: true,
    targetBucket: destination.replace(`${storageSeriesPaths().assetBase}${path.sep}`, ""),
    storedAt,
    confidence: "high",
    warning: undefined,
  });
  items[payload.itemIndex] = updatedItem;

  rememberStorageClassification({
    source: item.source,
    sourceKind: item.sourceKind,
    projectFolder,
    workflow,
    stage,
  });

  const nextSummary = `已记录 ${items.length} 项导入内容，其中 ${items.filter((entry) => entry.action === "copied").length} 项已复制，${items.filter((entry) => entry.action === "referenced").length} 项按引用登记。`;
  const nextManifest = {
    importedAt: manifest.importedAt ?? new Date().toISOString(),
    note: manifest.note ?? "",
    summary: nextSummary,
    items,
  };

  fs.writeFileSync(manifestPath, JSON.stringify(nextManifest, null, 2), "utf-8");
  const knowledgeNotePath = storageKnowledgeNotePathFromManifest(manifestPath);
  ensureDir(path.dirname(knowledgeNotePath));
  fs.writeFileSync(
    knowledgeNotePath,
    renderStorageImportNote(nextManifest.importedAt, nextSummary, nextManifest.note, items),
    "utf-8",
  );

  return {
    success: true,
    summary: nextSummary,
    manifestPath,
    knowledgeNotePath,
    importedAt: nextManifest.importedAt,
    items,
    updatedItem,
  };
}

function ensureTaskRuntimeDir() {
  fs.mkdirSync(path.dirname(taskHistoryPath), { recursive: true });
}

type StoredInputProfile = {
  id: string;
  name: string;
  values: Record<string, string>;
  updatedAt: string;
};

type InputProfileStore = Record<
  string,
  {
    defaultProfileId?: string;
    profiles: StoredInputProfile[];
  }
>;

function readInputProfiles(): InputProfileStore {
  if (!fs.existsSync(inputProfilesPath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(inputProfilesPath, "utf-8")) as InputProfileStore;
  } catch {
    return {};
  }
}

function writeInputProfiles(store: InputProfileStore) {
  ensureTaskRuntimeDir();
  fs.writeFileSync(inputProfilesPath, JSON.stringify(store, null, 2), "utf-8");
}

function sanitizeProfileValues(values: Record<string, string>) {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    next[key] = value ?? "";
  }
  return next;
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

type PersistedDecisionState = {
  status: "ignored" | "resolved" | "snoozed";
  updatedAt: string;
  snoozeUntil?: string;
  note?: string;
};

function readDecisionState(): Record<string, PersistedDecisionState> {
  if (!fs.existsSync(decisionStatePath)) {
    return {};
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(decisionStatePath, "utf-8")) as Record<string, PersistedDecisionState>;
    const nowValue = Date.now();
    let changed = false;
    const next: Record<string, PersistedDecisionState> = {};
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

function writeDecisionState(state: Record<string, PersistedDecisionState>) {
  ensureTaskRuntimeDir();
  fs.writeFileSync(decisionStatePath, JSON.stringify(state, null, 2), "utf-8");
}

function setDecisionState(
  decisionId: string,
  state: PersistedDecisionState | null,
) {
  const current = readDecisionState();
  if (state === null) {
    delete current[decisionId];
  } else {
    current[decisionId] = state;
  }
  writeDecisionState(current);
}

function findTaskById(taskId: string) {
  return [
    ...commandQueue.map((task) => normalizeTask(task)),
    ...readTaskHistory(),
  ].find((task) => task.id === taskId);
}

function queueClonedTask(task: AgentTask) {
  const cloned = createTask(task.nodeId, task.command, task.context);
  commandQueue.push(cloned);
  persistTask(cloned);
  return cloned;
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

function isSensitiveInputKey(key: string) {
  const normalized = key.toLowerCase();
  return (
    normalized.includes("password") ||
    normalized.includes("token") ||
    normalized.includes("secret") ||
    normalized.includes("授权") ||
    normalized.includes("密码")
  );
}

function redactInputValues(inputValues?: Record<string, string>) {
  if (!inputValues) {
    return inputValues;
  }
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(inputValues)) {
    sanitized[key] = isSensitiveInputKey(key) && value ? "********" : value;
  }
  return sanitized;
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
    context: task.context
      ? {
          ...task.context,
          inputValues: redactInputValues(task.context.inputValues),
        }
      : task.context,
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

function buildShortVideoDecisions(state: ShortVideoFactoryState): DecisionQueueItem[] {
  const items: DecisionQueueItem[] = [];

  if (state.latestSampleBatch && !state.latestResearchBundle) {
    items.push({
      id: "short-video:account-research",
      priority: "p1",
      title: "账号研究待运行",
      reason: "样本批次已建立，但账号研究还没有正式生成。",
      nextAction: "运行账号研究，先把单条 analysis bundle 和 raw 研究包产出来。",
      status: "open",
      relatedNodeId: "short_video_account_research",
      refs: [
        {
          label: "Sample Manifest",
          value: state.latestSampleBatch.path,
          path: state.latestSampleBatch.path,
        },
      ],
    });
  }

  if (state.latestResearchBundle && !state.latestCreativeBrief) {
    items.push({
      id: "short-video:creative-brief",
      priority: "p1",
      title: "是否纳入生产",
      reason: "账号研究已经完成，但 creative brief 还没有生成。",
      nextAction: "挑选一个值得模仿的样本或模式，并生成 creative brief。",
      status: "open",
      relatedNodeId: "short_video_creative_brief",
      refs: [
        {
          label: "Research Bundle",
          value: state.latestResearchBundle.path,
          path: state.latestResearchBundle.path,
        },
      ],
    });
  }

  if (state.latestCreativeBrief && !state.latestProductionPack) {
    items.push({
      id: "short-video:director",
      priority: "p1",
      title: "导演方案确认",
      reason: "Creative brief 已经到位，但导演与生产链还没有正式启动。",
      nextAction: "确认真人口播段、AI 补镜段和目标时长，然后启动导演与生产链。",
      status: "open",
      relatedNodeId: "short_video_director_production",
      refs: [
        {
          label: "Creative Brief",
          value: state.latestCreativeBrief.path,
          path: state.latestCreativeBrief.path,
        },
      ],
    });
  }

  if (state.notebooklmAvailable && state.latestResearchBundle && state.latestCreativeBrief && !state.latestNotebookEnhancedBrief) {
    items.push({
      id: "short-video:notebooklm",
      priority: "p2",
      title: "NotebookLM 增强归纳",
      reason: "账号研究和原始 creative brief 已完成，但还没有生成 NotebookLM 增强版 brief。",
      nextAction: "运行 NotebookLM 增强归纳，先补一版更强的创作建议再决定是否进入导演生产链。",
      status: "open",
      relatedNodeId: "notebooklm_account_enhance",
      refs: [
        {
          label: "Research Bundle",
          value: state.latestResearchBundle.path,
          path: state.latestResearchBundle.path,
        },
        {
          label: "Creative Brief",
          value: state.latestCreativeBrief.path,
          path: state.latestCreativeBrief.path,
        },
      ],
    });
  }

  if (!state.geminiConsentGranted) {
    items.push({
      id: "short-video:gemini-consent",
      priority: "p3",
      title: "Gemini 增强分析待确认",
      reason: "Gemini Web consent 尚未完成，关键帧增强分析还未纳入正式链路。",
      nextAction: "需要时先完成 consent，再把 Gemini 增强分析并入账号研究。",
      status: "watch",
      evidenceLevel: "declared",
      relatedNodeId: "short_video_factory",
    });
  }

  return items;
}

function buildTaskDecisionQueue(): DecisionQueueItem[] {
  const assetRoot = buildAssetRootState();
  const shortVideoFactory = buildShortVideoFactoryState();
  const decisionState = readDecisionState();
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
  return [...decisions, ...buildShortVideoDecisions(shortVideoFactory)]
    .filter((item) => {
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
    shortVideoFactory: buildShortVideoFactoryState(),
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

function humanReadableTmpDir() {
  return path.join(os.tmpdir(), "mission-control-human-readable");
}

function buildHumanReadableArtifact(pathValue: string) {
  const pythonProcess = spawnSync(
    "python3",
    [path.join(process.cwd(), "scripts", "render_human_readable_artifact.py"), "--path", pathValue],
    {
      cwd: process.cwd(),
      encoding: "utf-8",
      timeout: 20000,
    },
  );
  if (pythonProcess.status !== 0) {
    throw new Error(
      pythonProcess.stderr?.trim() ||
      pythonProcess.stdout?.trim() ||
      "Failed to render human artifact",
    );
  }
  return JSON.parse(pythonProcess.stdout) as {
    success: boolean;
    title: string;
    kind: string;
    content_md: string;
    source_path: string;
    suggested_filename: string;
  };
}

function buildHumanReadableDocx(pathValue: string) {
  const payload = buildHumanReadableArtifact(pathValue);
  const tempDir = humanReadableTmpDir();
  ensureDir(tempDir);
  const hash = crypto.createHash("sha1").update(pathValue).digest("hex").slice(0, 12);
  const htmlPath = path.join(tempDir, `${hash}.html`);
  const docxPath = path.join(tempDir, `${hash}.docx`);
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
  fs.writeFileSync(htmlPath, html, "utf-8");
  const conversion = spawnSync(
    "textutil",
    ["-convert", "docx", htmlPath, "-output", docxPath],
    {
      encoding: "utf-8",
      timeout: 20000,
    },
  );
  if (conversion.status !== 0 || !fs.existsSync(docxPath)) {
    throw new Error(conversion.stderr?.trim() || conversion.stdout?.trim() || "Failed to generate Word document");
  }
  return {
    ...payload,
    docxPath,
  };
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

function stageCommunityPackageUpload(fileName: string, contentBase64: string) {
  ensureDir(localPackageStagingRoot);
  const safeName = path.basename(fileName || "community-package.zip");
  const stagedPath = path.join(
    localPackageStagingRoot,
    `${Date.now()}-${safeName}`,
  );
  fs.writeFileSync(stagedPath, Buffer.from(contentBase64, "base64"));
  return stagedPath;
}

function runLocalPackageRegistry(args: string[]) {
  const result = spawnSync("python3", [localPackageRegistryScript, ...args], {
    cwd: process.cwd(),
    encoding: "utf-8",
    timeout: 120000,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || "Local package registry command failed");
  }
  return JSON.parse(result.stdout);
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

  app.use(express.json({ limit: "50mb" }));
  app.use("/exports", express.static(path.join(process.cwd(), "exports")));

  let clients: express.Response[] = [];

  const queueShortVideoTask = (
    nodeId:
      | "short_video_account_research"
      | "short_video_creative_brief"
      | "short_video_director_production"
      | "short_video_insight_capture"
      | "notebooklm_account_enhance",
    command: string,
    inputValues: Record<string, string>,
  ) => {
    const task = createTask(nodeId, command, {
      inputValues,
      sourcePath: path.join(process.cwd(), "scripts"),
      sourceType: "content-system",
      requiredSkills: [],
      assetRootPath: buildAssetRootState().path,
    });
    commandQueue.push(task);
    persistTask(task);
    broadcast(clients, {
      type: "task-queued",
      payload: task,
    });
    emitHeartbeat(clients);
    return task;
  };

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

  app.get("/api/v1/artifact/human", (req, res) => {
    const rawPath =
      typeof req.query.path === "string" ? req.query.path.trim() : "";
    if (!rawPath) {
      return res.status(400).send("Missing path");
    }
    if (!isAllowedDocPath(rawPath) && !isAllowedFileActionPath(rawPath)) {
      return res.status(403).send("Path not allowed");
    }
    if (!fs.existsSync(rawPath)) {
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
    <title>${escapeHtml(artifact.title)} · OpenClaw Console</title>
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
        <a class="primary" href="/api/v1/artifact/human/download-docx?path=${encodeURIComponent(rawPath)}">下载 Word</a>
        <a href="/api/v1/doc?path=${encodeURIComponent(rawPath)}">查看原始记录</a>
      </div>
      <div class="meta">${escapeHtml(artifact.kind)}</div>
      <div class="card"><div class="doc">${renderMarkdownDocument(artifact.content_md)}</div></div>
      <div class="source">原始路径：${escapeHtml(rawPath)}</div>
    </div>
  </body>
</html>`);
    } catch (error) {
      return res.status(500).send(error instanceof Error ? error.message : "Failed to render artifact");
    }
  });

  app.get("/api/v1/artifact/human/download-docx", (req, res) => {
    const rawPath =
      typeof req.query.path === "string" ? req.query.path.trim() : "";
    if (!rawPath) {
      return res.status(400).send("Missing path");
    }
    if (!isAllowedDocPath(rawPath) && !isAllowedFileActionPath(rawPath)) {
      return res.status(403).send("Path not allowed");
    }
    if (!fs.existsSync(rawPath)) {
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

  app.post("/api/v1/control-plane/decision-action", (req, res) => {
    const decisionId =
      typeof req.body?.decisionId === "string" ? req.body.decisionId.trim() : "";
    const action =
      typeof req.body?.action === "string" ? req.body.action.trim() : "";
    const relatedTaskId =
      typeof req.body?.relatedTaskId === "string" ? req.body.relatedTaskId.trim() : "";
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";

    if (!decisionId || !action) {
      return res.status(400).json({ error: "decisionId and action are required" });
    }

    if (action === "ignore") {
      setDecisionState(decisionId, {
        status: "ignored",
        updatedAt: new Date().toISOString(),
        note,
      });
      emitHeartbeat(clients);
      return res.json({ success: true });
    }

    if (action === "resolve") {
      setDecisionState(decisionId, {
        status: "resolved",
        updatedAt: new Date().toISOString(),
        note,
      });
      emitHeartbeat(clients);
      return res.json({ success: true });
    }

    if (action === "snooze") {
      const snoozeUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      setDecisionState(decisionId, {
        status: "snoozed",
        updatedAt: new Date().toISOString(),
        snoozeUntil,
        note,
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
        updatedAt: new Date().toISOString(),
        note: note || "retry queued",
      });
      broadcast(clients, {
        type: "task-queued",
        payload: queuedTask,
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
    const projectSeries =
      typeof req.body?.projectSeries === "string" ? req.body.projectSeries.trim() : "";

    if (!query) {
      return res.json({ assets: [], knowledge: [] });
    }

    const assets =
      scope === "knowledge"
        ? []
        : searchAssetEntries({
            query,
            type,
            platform,
            projectSeries,
          });
    const knowledge =
      scope === "assets"
        ? []
        : searchKnowledgeEntries({
            query,
            platform,
            projectSeries,
          });

    return res.json({ assets, knowledge });
  });

  app.get("/api/v1/storage-retrieval/recent", (_req, res) => {
    return res.json({
      imports: fetchStorageImportRecent(),
    });
  });

  app.post("/api/v1/storage-retrieval/import", (req, res) => {
    const pathEntries = Array.isArray(req.body?.pathEntries)
      ? req.body.pathEntries.map((item: unknown) => String(item).trim()).filter(Boolean)
      : [];
    const linkEntries = Array.isArray(req.body?.linkEntries)
      ? req.body.linkEntries.map((item: unknown) => String(item).trim()).filter(Boolean)
      : [];
    const files = Array.isArray(req.body?.files)
      ? req.body.files.map((item: any) => ({
          name: String(item?.name ?? ""),
          relativePath: String(item?.relativePath ?? item?.name ?? ""),
          contentBase64: String(item?.contentBase64 ?? ""),
        }))
      : [];
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";

    if (pathEntries.length === 0 && linkEntries.length === 0 && files.length === 0) {
      return res.status(400).json({ error: "Nothing to import" });
    }

    try {
      const result = createStorageImportRecord({
        pathEntries,
        linkEntries,
        note,
        files,
      });
      return res.json(result);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to import storage items",
      });
    }
  });

  app.post("/api/v1/storage-retrieval/reclassify", (req, res) => {
    const manifestPath =
      typeof req.body?.manifestPath === "string" ? req.body.manifestPath.trim() : "";
    const itemIndex = Number(req.body?.itemIndex);
    const projectFolder =
      typeof req.body?.projectFolder === "string" ? req.body.projectFolder.trim() : "";
    const workflow =
      typeof req.body?.workflow === "string" ? req.body.workflow.trim() : "";
    const stage =
      typeof req.body?.stage === "string" ? req.body.stage.trim() : "";

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
        stage,
      });
      return res.json(result);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to reclassify import item",
      });
    }
  });

  app.get("/api/v1/local-packages", (_req, res) => {
    try {
      return res.json(runLocalPackageRegistry(["list"]));
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to list local packages",
      });
    }
  });

  app.post("/api/v1/local-packages/inspect", (req, res) => {
    try {
      let packagePath =
        typeof req.body?.packagePath === "string" ? req.body.packagePath.trim() : "";
      const fileName =
        typeof req.body?.fileName === "string" ? req.body.fileName.trim() : "";
      const contentBase64 =
        typeof req.body?.contentBase64 === "string" ? req.body.contentBase64 : "";

      if (!packagePath && fileName && contentBase64) {
        packagePath = stageCommunityPackageUpload(fileName, contentBase64);
      }
      if (!packagePath) {
        return res.status(400).json({ error: "packagePath or uploaded package content is required" });
      }
      if (!contentBase64 && !isAllowedFileActionPath(packagePath)) {
        return res.status(403).json({ error: "Package path not allowed" });
      }
      return res.json(runLocalPackageRegistry(["inspect", "--package-path", path.resolve(packagePath)]));
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to inspect local package",
      });
    }
  });

  app.post("/api/v1/local-packages/install", (req, res) => {
    try {
      const packagePath =
        typeof req.body?.packagePath === "string" ? req.body.packagePath.trim() : "";
      const distributionChannel =
        typeof req.body?.distributionChannel === "string" ? req.body.distributionChannel.trim() : "local-file";
      const releaseUrl =
        typeof req.body?.releaseUrl === "string" ? req.body.releaseUrl.trim() : "";
      const sourceRepo =
        typeof req.body?.sourceRepo === "string" ? req.body.sourceRepo.trim() : "";
      const sourceTag =
        typeof req.body?.sourceTag === "string" ? req.body.sourceTag.trim() : "";
      if (!packagePath) {
        return res.status(400).json({ error: "packagePath is required" });
      }
      if (!isAllowedFileActionPath(packagePath)) {
        return res.status(403).json({ error: "Package path not allowed" });
      }
      return res.json(
        runLocalPackageRegistry([
          "install",
          "--package-path",
          path.resolve(packagePath),
          "--distribution-channel",
          distributionChannel,
          "--release-url",
          releaseUrl,
          "--source-repo",
          sourceRepo,
          "--source-tag",
          sourceTag,
        ]),
      );
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to install local package",
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
        runLocalPackageRegistry(["enable", "--package-id", packageId, "--version", version]),
      );
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to enable local package",
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
        runLocalPackageRegistry(["disable", "--package-id", packageId, "--version", version]),
      );
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to disable local package",
      });
    }
  });

  app.post("/api/v1/local-packages/rollback", (req, res) => {
    try {
      const packageId = typeof req.body?.packageId === "string" ? req.body.packageId.trim() : "";
      const targetVersion =
        typeof req.body?.targetVersion === "string" ? req.body.targetVersion.trim() : "";
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
        error: error instanceof Error ? error.message : "Failed to rollback local package",
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
        runLocalPackageRegistry(["uninstall", "--package-id", packageId, "--version", version]),
      );
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to uninstall local package",
      });
    }
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

  app.post("/api/v1/control-plane/short-video/sample-batch", (req, res) => {
    const platform = typeof req.body?.platform === "string" ? req.body.platform.trim() : "mixed";
    const accountName =
      typeof req.body?.accountName === "string" ? req.body.accountName.trim() : "";
    const accountHandle =
      typeof req.body?.accountHandle === "string" ? req.body.accountHandle.trim() : "";
    const objective =
      typeof req.body?.objective === "string" && req.body.objective.trim()
        ? req.body.objective.trim()
        : "建立对标账号样本批次并进入短视频资产工厂";
    const sampleSize = Number(req.body?.sampleSize ?? DEFAULT_SHORT_VIDEO_SAMPLE_SIZE);
    const targetMode =
      typeof req.body?.targetMode === "string" && req.body.targetMode.trim()
        ? req.body.targetMode.trim()
        : "script-first";
    const batchId =
      typeof req.body?.batchId === "string" && req.body.batchId.trim()
        ? req.body.batchId.trim()
        : "batch-001";
    const links = Array.isArray(req.body?.links) ? req.body.links : [];

    if (!accountName) {
      return res.status(400).json({ error: "accountName is required" });
    }
    if (links.length < DEFAULT_SHORT_VIDEO_MIN_SAMPLE_SIZE) {
      return res.status(400).json({
        error: `At least ${DEFAULT_SHORT_VIDEO_MIN_SAMPLE_SIZE} links are required`,
      });
    }

    const batchProcess = spawnSync(
      "python3",
      [
        path.join(process.cwd(), "scripts", "run_short_video_sample_batch.py"),
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
        JSON.stringify(links),
      ],
      {
        cwd: process.cwd(),
        encoding: "utf-8",
        timeout: 30000,
      },
    );

    if (batchProcess.status !== 0) {
      return res.status(500).json({
        error:
          batchProcess.stderr?.trim() ||
          batchProcess.stdout?.trim() ||
          "Failed to create short-video sample batch",
      });
    }

    const payload = JSON.parse(batchProcess.stdout);
    return res.json({
      success: true,
      sampleManifest: payload.sample_manifest,
      sourceLinksCsv: payload.source_links_csv,
      executionSummary: payload.execution_summary,
    });
  });

  app.post("/api/v1/control-plane/short-video/account-research", (req, res) => {
    const manifestPath =
      typeof req.body?.manifestPath === "string" ? path.resolve(req.body.manifestPath.trim()) : "";
    const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
    if (!manifestPath) {
      return res.status(400).json({ error: "manifestPath is required" });
    }
    if (!isAllowedDocPath(manifestPath) || !fs.existsSync(manifestPath)) {
      return res.status(400).json({ error: "manifestPath is not accessible" });
    }

    const task = queueShortVideoTask(
      "short_video_account_research",
      `python3 ${path.join(process.cwd(), "scripts", "run_short_video_account_research.py")} --manifest-path <样本清单路径>`,
      {
        样本清单路径: manifestPath,
        API_KEY: apiKey,
      },
    );
    return res.json({
      success: true,
      message: "Short-video account research queued",
      task,
    });
  });

  app.post("/api/v1/control-plane/short-video/creative-brief", (req, res) => {
    const researchBundlePath =
      typeof req.body?.researchBundlePath === "string"
        ? path.resolve(req.body.researchBundlePath.trim())
        : "";
    const selectedContentIds = Array.isArray(req.body?.selectedContentIds)
      ? req.body.selectedContentIds
          .map((item: unknown) => String(item).trim())
          .filter(Boolean)
      : [];
    const targetPlatform =
      typeof req.body?.targetPlatform === "string" && req.body.targetPlatform.trim()
        ? req.body.targetPlatform.trim()
        : "douyin";
    const targetGoal =
      typeof req.body?.targetGoal === "string" && req.body.targetGoal.trim()
        ? req.body.targetGoal.trim()
        : "产出口播优先的短视频创作包";
    const imitationStrategy =
      typeof req.body?.imitationStrategy === "string" ? req.body.imitationStrategy.trim() : "";
    const tone = typeof req.body?.tone === "string" ? req.body.tone.trim() : "";
    const durationTarget = Number(req.body?.durationTarget ?? 35);

    if (!researchBundlePath) {
      return res.status(400).json({ error: "researchBundlePath is required" });
    }
    if (!isAllowedDocPath(researchBundlePath) || !fs.existsSync(researchBundlePath)) {
      return res.status(400).json({ error: "researchBundlePath is not accessible" });
    }

    const task = queueShortVideoTask(
      "short_video_creative_brief",
      `python3 ${path.join(process.cwd(), "scripts", "run_short_video_creative_brief.py")} --research-bundle-path <账号研究包路径>`,
      {
        账号研究包路径: researchBundlePath,
        选中的内容ID列表: selectedContentIds.join(","),
        目标平台: targetPlatform,
        创作目标: targetGoal,
        模仿策略: imitationStrategy,
        语气: tone,
        目标时长秒: String(Number.isFinite(durationTarget) ? durationTarget : 35),
      },
    );
    return res.json({
      success: true,
      message: "Creative brief queued",
      task,
    });
  });

  app.post("/api/v1/control-plane/short-video/director-production", (req, res) => {
    const creativeBriefPath =
      typeof req.body?.creativeBriefPath === "string"
        ? path.resolve(req.body.creativeBriefPath.trim())
        : "";
    const generateAiClips = Boolean(req.body?.generateAiClips);
    if (!creativeBriefPath) {
      return res.status(400).json({ error: "creativeBriefPath is required" });
    }
    if (!isAllowedDocPath(creativeBriefPath) || !fs.existsSync(creativeBriefPath)) {
      return res.status(400).json({ error: "creativeBriefPath is not accessible" });
    }

    const task = queueShortVideoTask(
      "short_video_director_production",
      `python3 ${path.join(process.cwd(), "scripts", "run_short_video_director_production.py")} --creative-brief-path <creative_brief 路径>`,
      {
        "creative_brief 路径": creativeBriefPath,
        是否生成AI补镜: generateAiClips ? "yes" : "no",
      },
    );
    return res.json({
      success: true,
      message: "Director production queued",
      task,
    });
  });

  app.post("/api/v1/control-plane/short-video/notebooklm-enhance", (req, res) => {
    const researchBundlePath =
      typeof req.body?.researchBundlePath === "string"
        ? path.resolve(req.body.researchBundlePath.trim())
        : "";
    const creativeBriefPath =
      typeof req.body?.creativeBriefPath === "string"
        ? path.resolve(req.body.creativeBriefPath.trim())
        : "";

    if (!researchBundlePath) {
      return res.status(400).json({ error: "researchBundlePath is required" });
    }
    if (!creativeBriefPath) {
      return res.status(400).json({ error: "creativeBriefPath is required" });
    }
    if (!isAllowedDocPath(researchBundlePath) || !fs.existsSync(researchBundlePath)) {
      return res.status(400).json({ error: "researchBundlePath is not accessible" });
    }
    if (!isAllowedDocPath(creativeBriefPath) || !fs.existsSync(creativeBriefPath)) {
      return res.status(400).json({ error: "creativeBriefPath is not accessible" });
    }

    const task = queueShortVideoTask(
      "notebooklm_account_enhance",
      `python3 ${path.join(process.cwd(), "scripts", "run_notebooklm_account_enhance.py")} --research-bundle-path <账号研究包路径> --creative-brief-path <creative_brief 路径>`,
      {
        账号研究包路径: researchBundlePath,
        "creative_brief 路径": creativeBriefPath,
      },
    );
    return res.json({
      success: true,
      message: "NotebookLM enhancement queued",
      task,
    });
  });

  app.post("/api/v1/control-plane/short-video/inspiration-capture", (req, res) => {
    const videoUrl =
      typeof req.body?.videoUrl === "string" ? req.body.videoUrl.trim() : "";
    const objective =
      typeof req.body?.objective === "string" && req.body.objective.trim()
        ? req.body.objective.trim()
        : "把收藏视频沉淀成可阅读、可检索、可继续提问的洞察记录";
    const reflectionNote =
      typeof req.body?.reflectionNote === "string" ? req.body.reflectionNote.trim() : "";
    const collectionName =
      typeof req.body?.collectionName === "string" && req.body.collectionName.trim()
        ? req.body.collectionName.trim()
        : "收藏视频";
    const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";

    if (!videoUrl) {
      return res.status(400).json({ error: "videoUrl is required" });
    }

    const task = queueShortVideoTask(
      "short_video_insight_capture",
      `python3 ${path.join(process.cwd(), "scripts", "run_saved_video_insight_capture.py")} --video-url <收藏视频链接>`,
      {
        收藏视频链接: videoUrl,
        洞察目标: objective,
        收藏备注: reflectionNote,
        收藏集合名: collectionName,
        API_KEY: apiKey,
      },
    );
    return res.json({
      success: true,
      message: "Saved video insight capture queued",
      task,
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
    const values =
      req.body?.values && typeof req.body.values === "object"
        ? sanitizeProfileValues(req.body.values as Record<string, string>)
        : {};

    if (!nodeId || !name) {
      return res.status(400).json({ error: "nodeId and name are required" });
    }

    const store = readInputProfiles();
    const current = store[nodeId] ?? { profiles: [] as StoredInputProfile[] };
    const nowStamp = new Date().toISOString();
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
        updatedAt: nowStamp,
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
      profiles: current.profiles,
    });
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

    const feedbackRoot = path.join(runtimeRoot, "knowledge", "feedback");
    const evolutionRoot = path.join(runtimeRoot, "knowledge", "evolution");
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
    setTimeout(() => {
      residentAgentStartGracePassed = true;
      ensureResidentAgent();
    }, RESIDENT_AGENT_START_GRACE_MS);
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
