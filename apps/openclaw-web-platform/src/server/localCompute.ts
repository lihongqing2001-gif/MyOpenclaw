import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  AdminLocalComputeSnapshot,
  LocalComputeArtifact,
  LocalComputeNode,
  LocalComputeNodeCapability,
  LocalComputeTask,
  PackageRecord,
  User,
} from "../contracts/types";
import { CommunityPackageManifest } from "../contracts/community-package";
import { WebPlatformDatabase, createId, getWebPlatformPaths, localComputeTaskDir } from "./store";

const heartbeatTimeoutMs = Number(process.env.SOLOCORE_LOCAL_COMPUTE_HEARTBEAT_TIMEOUT_MS || "45000");

function normalizeToken(token: string) {
  return token.trim();
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(normalizeToken(token)).digest("hex");
}

function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

function createTokenPreview(token: string) {
  return `${token.slice(0, 8)}...${token.slice(-6)}`;
}

export function refreshLocalComputeNodes(db: WebPlatformDatabase) {
  const now = Date.now();
  db.localComputeNodes = db.localComputeNodes.map((node) => {
    if (!node.lastSeenAt) {
      return {
        ...node,
        status: node.currentTaskId ? node.status : "offline",
      };
    }
    if (Date.parse(node.lastSeenAt) + heartbeatTimeoutMs < now && node.status !== "offline") {
      return {
        ...node,
        status: "offline",
        currentTaskId: undefined,
      };
    }
    return node;
  });
}

export function createLocalComputeNode(
  db: WebPlatformDatabase,
  ownerUser: User,
  input: {
    label: string;
    allowedPackageIds: string[];
    allowedNodeIds: string[];
    capabilities: LocalComputeNodeCapability[];
  },
) {
  const plainToken = generateToken();
  const now = new Date().toISOString();
  const node: LocalComputeNode = {
    nodeId: createId("local_node"),
    label: input.label.trim() || "Local Compute Node",
    ownerUserId: ownerUser.id,
    mode: "local-compute",
    status: "offline",
    resultPolicy: "full-sync",
    capabilities: input.capabilities,
    allowedPackageIds: input.allowedPackageIds,
    allowedNodeIds: input.allowedNodeIds,
    tokenHash: hashToken(plainToken),
    tokenPreview: createTokenPreview(plainToken),
    createdAt: now,
    updatedAt: now,
  };
  db.localComputeNodes.push(node);
  return { node, plainToken };
}

export function authenticateLocalComputeNode(
  db: WebPlatformDatabase,
  nodeId: string,
  token: string,
) {
  refreshLocalComputeNodes(db);
  const node = db.localComputeNodes.find((item) => item.nodeId === nodeId);
  if (!node) {
    return null;
  }
  if (node.tokenHash !== hashToken(token)) {
    return null;
  }
  return node;
}

export function markLocalComputeHeartbeat(
  node: LocalComputeNode,
  input: {
    status?: LocalComputeNode["status"];
    lastError?: string;
    currentTaskId?: string;
    heartbeatMeta?: LocalComputeNode["heartbeatMeta"];
  },
) {
  node.lastSeenAt = new Date().toISOString();
  node.updatedAt = node.lastSeenAt;
  node.status = input.status || (node.currentTaskId ? "busy" : "online");
  node.currentTaskId = input.currentTaskId;
  node.lastError = input.lastError;
  node.heartbeatMeta = input.heartbeatMeta;
}

function firstPackageCapability(manifest: CommunityPackageManifest) {
  return manifest.capabilities.find((item) => Boolean(item.entrypoint)) || manifest.capabilities[0] || null;
}

export function resolveLocalComputePackageTarget(record: PackageRecord, version?: string) {
  const selectedVersion = version || record.latestVersion;
  const versionRecord = record.versions.find((item) => item.version === selectedVersion);
  if (!versionRecord) {
    throw new Error("Package version not found");
  }
  const capability = firstPackageCapability(versionRecord.manifest);
  if (!capability?.entrypoint) {
    throw new Error("Package does not expose an executable capability entrypoint");
  }
  return {
    packageVersion: selectedVersion,
    targetNodeId: capability.id,
    targetLabel: capability.label || record.name,
    command: capability.entrypoint,
  };
}

export function createLocalComputeTask(
  db: WebPlatformDatabase,
  input: {
    node: LocalComputeNode;
    createdByUser: User;
    taskKind: LocalComputeTask["taskKind"];
    packageId?: string;
    packageVersion?: string;
    targetNodeId?: string;
    targetLabel: string;
    command: string;
    inputValues?: Record<string, string>;
  },
) {
  const now = new Date().toISOString();
  const task: LocalComputeTask = {
    id: createId("local_task"),
    nodeId: input.node.nodeId,
    taskKind: input.taskKind,
    status: "queued",
    createdByUserId: input.createdByUser.id,
    createdAt: now,
    updatedAt: now,
    packageId: input.packageId,
    packageVersion: input.packageVersion,
    targetNodeId: input.targetNodeId,
    targetLabel: input.targetLabel,
    command: input.command,
    inputValues: input.inputValues || {},
    artifacts: [],
  };
  db.localComputeTasks.unshift(task);
  return task;
}

export function nextQueuedLocalComputeTask(db: WebPlatformDatabase, node: LocalComputeNode) {
  refreshLocalComputeNodes(db);
  const task = db.localComputeTasks
    .filter((item) => item.nodeId === node.nodeId && item.status === "queued")
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0];
  if (!task) {
    return null;
  }
  const now = new Date().toISOString();
  task.status = "running";
  task.startedAt = now;
  task.updatedAt = now;
  node.status = "busy";
  node.currentTaskId = task.id;
  node.updatedAt = now;
  node.lastSeenAt = now;
  return task;
}

export function storeLocalComputeArtifact(
  task: LocalComputeTask,
  artifact: {
    fileName: string;
    label?: string;
    contentType?: string;
    contentBase64: string;
  },
) {
  const dirPath = localComputeTaskDir(task.id);
  fs.mkdirSync(dirPath, { recursive: true });
  const fileName = path.basename(artifact.fileName || `${createId("artifact")}.bin`);
  const artifactId = createId("artifact");
  const targetPath = path.join(dirPath, `${artifactId}-${fileName}`);
  const buffer = Buffer.from(artifact.contentBase64, "base64");
  fs.writeFileSync(targetPath, buffer);
  const record: LocalComputeArtifact = {
    id: artifactId,
    fileName,
    contentType: artifact.contentType || "application/octet-stream",
    label: artifact.label,
    path: targetPath,
    sizeBytes: buffer.length,
    uploadedAt: new Date().toISOString(),
  };
  task.artifacts.push(record);
  return record;
}

export function updateLocalComputeTask(
  task: LocalComputeTask,
  node: LocalComputeNode,
  input: {
    status?: LocalComputeTask["status"];
    summary?: string;
    resultDetail?: string;
    error?: string;
    syncManifest?: Record<string, unknown>;
    localBrokerTaskId?: string;
  },
) {
  const now = new Date().toISOString();
  task.updatedAt = now;
  if (input.status) {
    task.status = input.status;
  }
  if (typeof input.summary === "string") {
    task.summary = input.summary;
  }
  if (typeof input.resultDetail === "string") {
    task.resultDetail = input.resultDetail;
  }
  if (typeof input.error === "string") {
    task.error = input.error;
  }
  if (typeof input.localBrokerTaskId === "string") {
    task.localBrokerTaskId = input.localBrokerTaskId;
  }
  if (input.syncManifest) {
    task.syncManifest = input.syncManifest;
  }
  if (task.status === "completed" || task.status === "failed") {
    task.completedAt = now;
    node.currentTaskId = undefined;
    node.status = task.status === "completed" ? "online" : "error";
    node.lastError = task.status === "failed" ? task.error || task.summary : undefined;
  } else if (task.status === "running") {
    node.status = "busy";
    node.currentTaskId = task.id;
  }
  node.lastSeenAt = now;
  node.updatedAt = now;
}

export function buildAdminLocalComputeSnapshot(db: WebPlatformDatabase): AdminLocalComputeSnapshot {
  refreshLocalComputeNodes(db);
  return {
    nodes: [...db.localComputeNodes].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    tasks: [...db.localComputeTasks].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
  };
}

export function localComputeStorageRoot() {
  return path.join(getWebPlatformPaths().localComputeDir, "tasks");
}
