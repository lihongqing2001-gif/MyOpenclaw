import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  AdminLocalComputeSnapshot,
  LocalComputeArtifact,
  LocalComputeNode,
  LocalComputeNodeCapability,
  LocalComputeTask,
  SharedRuntimeSnapshot,
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

function normalizeCapabilityKey(value: string) {
  return value.trim().toLowerCase();
}

function buildOnboardingCapabilityKeys(manifest: CommunityPackageManifest) {
  const requirements = manifest.onboarding?.requirements || [];
  return Array.from(
    new Set(
      requirements.flatMap((requirement) => {
        if (!requirement.required) {
          return [];
        }
        if (requirement.kind === "login" || requirement.kind === "consent") {
          const provider = String(requirement.provider || requirement.key || requirement.id || "").trim();
          return provider ? [`${requirement.kind}:${normalizeCapabilityKey(provider)}`] : [];
        }
        if (requirement.kind === "config") {
          const key = String(requirement.key || requirement.id || "").trim();
          return key ? [`config:${normalizeCapabilityKey(key)}`] : [];
        }
        return [];
      }),
    ),
  );
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
    sharedWithUserIds: string[];
    sharingMode: LocalComputeNode["sharingMode"];
    allowedPathScopes: string[];
    allowedAuthCapabilities: string[];
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
    sharingMode: input.sharingMode,
    sharedWithUserIds: input.sharedWithUserIds,
    status: "offline",
    resultPolicy: "full-sync",
    capabilities: input.capabilities,
    allowedPackageIds: input.allowedPackageIds,
    allowedNodeIds: input.allowedNodeIds,
    allowedPathScopes: input.allowedPathScopes,
    allowedAuthCapabilities: input.allowedAuthCapabilities.map(normalizeCapabilityKey),
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

export function canUserAccessLocalComputeNode(node: LocalComputeNode, user: User) {
  return node.ownerUserId === user.id || (node.sharingMode === "trusted-shared" && node.sharedWithUserIds.includes(user.id));
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
    ownerUserId?: string;
    requestedByUserId?: string;
    accessMode?: LocalComputeTask["accessMode"];
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
    requestedByUserId: input.requestedByUserId || input.createdByUser.id,
    ownerUserId: input.ownerUserId || input.node.ownerUserId,
    accessMode: input.accessMode || (input.createdByUser.id === input.node.ownerUserId ? "owner" : "trusted-shared"),
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
  const emailById = new Map(db.users.map((user) => [user.id, user.email]));
  return {
    nodes: [...db.localComputeNodes]
      .map((node) => ({
        ...node,
        ownerEmail: emailById.get(node.ownerUserId),
        sharedWithUsers: node.sharedWithUserIds
          .map((userId) => {
            const email = emailById.get(userId);
            return email ? { userId, email } : null;
          })
          .filter((item): item is { userId: string; email: string } => Boolean(item)),
      }))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    tasks: [...db.localComputeTasks].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
  };
}

export function buildSharedRuntimeSnapshot(db: WebPlatformDatabase, user: User): SharedRuntimeSnapshot {
  refreshLocalComputeNodes(db);
  const emailById = new Map(db.users.map((candidate) => [candidate.id, candidate.email]));
  const accessibleNodes = db.localComputeNodes
    .filter((node) => canUserAccessLocalComputeNode(node, user))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  const nodes = accessibleNodes.map((node) => {
    const packageIds =
      node.allowedPackageIds.length > 0
        ? node.allowedPackageIds
        : node.ownerUserId === user.id
          ? db.packages.map((pkg) => pkg.packageId)
          : [];
    return {
      node: {
        ...node,
        ownerEmail: emailById.get(node.ownerUserId),
        sharedWithUsers: node.sharedWithUserIds
          .map((userId) => {
            const email = emailById.get(userId);
            return email ? { userId, email } : null;
          })
          .filter((item): item is { userId: string; email: string } => Boolean(item)),
      },
      availablePackages: db.packages
        .filter((pkg) => packageIds.includes(pkg.packageId))
        .map((pkg) => {
          const versionRecord = pkg.versions.find((item) => item.version === pkg.latestVersion);
          return {
            packageId: pkg.packageId,
            name: pkg.name,
            latestVersion: pkg.latestVersion,
            description: pkg.resourceMeta?.install?.notes?.[0] || pkg.name,
            visibility: pkg.visibility,
            requiredAuthCapabilities: versionRecord ? buildOnboardingCapabilityKeys(versionRecord.manifest) : [],
          };
        }),
    };
  });

  const visibleNodeIds = new Set(accessibleNodes.map((node) => node.nodeId));
  const tasks = db.localComputeTasks
    .filter((task) => visibleNodeIds.has(task.nodeId) && (task.ownerUserId === user.id || task.requestedByUserId === user.id))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  return { nodes, tasks };
}

export function assertSharedRuntimePackageAccess(
  node: LocalComputeNode,
  user: User,
  record: PackageRecord,
) {
  if (!canUserAccessLocalComputeNode(node, user)) {
    throw new Error("You do not have access to this shared runtime");
  }
  if (node.ownerUserId !== user.id) {
    if (node.allowedPackageIds.length === 0) {
      throw new Error("No shared packages are configured for this runtime");
    }
    if (!node.allowedPackageIds.includes(record.packageId)) {
      throw new Error("Package is not shared on this runtime");
    }
    const versionRecord = record.versions.find((item) => item.version === record.latestVersion);
    const requiredAuthCapabilities = versionRecord ? buildOnboardingCapabilityKeys(versionRecord.manifest) : [];
    const missingCapabilities = requiredAuthCapabilities.filter((item) => !node.allowedAuthCapabilities.includes(normalizeCapabilityKey(item)));
    if (missingCapabilities.length > 0) {
      throw new Error(`Shared runtime is missing required auth capabilities: ${missingCapabilities.join(", ")}`);
    }
  }
}

export function localComputeStorageRoot() {
  return path.join(getWebPlatformPaths().localComputeDir, "tasks");
}
