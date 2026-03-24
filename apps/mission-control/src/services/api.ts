import { seedKnowledgeBase } from "../data/mockKnowledge";
import {
  AgentTask,
  AssetRootConfig,
  CommunityPackageInspection,
  InstalledCommunityPackage,
  ControlPlaneState,
  HeartbeatPayload,
  KnowledgeItem,
  PortableBundleExport,
  SkillModule,
  SkillNode,
  SkillTreeResponse,
  TaskFeedbackResult,
  TaskHistoryResponse,
} from "../types";
import { mockSkillNodes } from "../data/mockData";

const mockKnowledgeDB: KnowledgeItem[] = [...seedKnowledgeBase];

const searchLocalKnowledge = (
  query: string,
  domain?: string,
  platform?: string,
): KnowledgeItem[] =>
  mockKnowledgeDB.filter((item) => {
    const normalizedQuery = query.trim();
    const matchQuery = normalizedQuery
      ? item.human.title.includes(normalizedQuery) ||
        item.human.summary.includes(normalizedQuery) ||
        item.human.tags.some((tag) => tag.includes(normalizedQuery))
      : true;
    const matchDomain = domain ? item.human.domain === domain : true;
    const matchPlatform = platform ? item.human.platform === platform : true;
    return matchQuery && matchDomain && matchPlatform;
  });

export const searchKnowledge = async (
  query: string,
  domain?: string,
  platform?: string,
): Promise<{ results: KnowledgeItem[] }> => {
  try {
    const response = await fetch("/api/v1/knowledge/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, domain, platform }),
    });

    if (!response.ok) {
      throw new Error("Failed to search knowledge base");
    }

    const data = await response.json();

    if (data.results && data.results.length === 0) {
      return { results: searchLocalKnowledge(query, domain, platform) };
    }

    return data;
  } catch (error) {
    console.error("Error searching knowledge:", error);
    return { results: searchLocalKnowledge(query, domain, platform) };
  }
};

export const ingestKnowledge = async (item: KnowledgeItem): Promise<{ success: boolean }> => {
  const response = await fetch("/api/v1/knowledge/ingest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "upsert",
      payload: item,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to ingest knowledge");
  }

  return response.json();
};

export const fetchSkillTree = async (): Promise<SkillTreeResponse> => {
  try {
    const response = await fetch("/api/v1/skill-tree");
    if (!response.ok) {
      throw new Error("Failed to fetch skill tree");
    }

    const data = (await response.json()) as SkillTreeResponse;
    if (!Array.isArray(data.nodes) || data.nodes.length === 0) {
      return { nodes: mockSkillNodes as SkillNode[], source: "mock-fallback" };
    }

    return data;
  } catch (error) {
    console.error("Error fetching skill tree:", error);
    return { nodes: mockSkillNodes as SkillNode[], source: "mock-fallback" };
  }
};

let sharedEventSource: EventSource | null = null;
const streamListeners = new Set<(data: unknown) => void>();

export const subscribeToStream = (onMessage: (data: unknown) => void) => {
  if (!sharedEventSource) {
    sharedEventSource = new EventSource("/api/v1/stream");
    sharedEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        streamListeners.forEach((listener) => listener(data));
      } catch (err) {
        console.error("Failed to parse stream message", err);
      }
    };
  }

  streamListeners.add(onMessage);

  return () => {
    streamListeners.delete(onMessage);
    if (streamListeners.size === 0 && sharedEventSource) {
      sharedEventSource.close();
      sharedEventSource = null;
    }
  };
};

export const subscribeToKnowledgeStream = (onMessage: (data: any) => void) => {
  return subscribeToStream((data) => {
    if (typeof data !== "object" || data === null) {
      return;
    }

    const streamData = data as {
      type?: string;
      action?: string;
      payload?: HeartbeatPayload | KnowledgeItem;
    };

    if (streamData.type === "knowledge") {
      onMessage({ type: streamData.action, payload: streamData.payload });
    } else if (streamData.type === "heartbeat") {
      onMessage({ type: "heartbeat", payload: streamData.payload });
    }
  });
};

export const executeNode = async (
  nodeId: string,
  command: string,
  options?: {
    inputValues?: Record<string, string>;
    sourcePath?: string;
    sourceType?: SkillNode["sourceType"];
    inputSchema?: NonNullable<SkillNode["drawerContent"]>["inputs"];
    route?: NonNullable<SkillNode["drawerContent"]>["route"];
    requiredSkills?: SkillModule[];
  },
): Promise<{ success: boolean; message: string; task: AgentTask }> => {
  const response = await fetch("/api/v1/node-execute", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nodeId,
      command,
      inputValues: options?.inputValues ?? {},
      sourcePath: options?.sourcePath,
      sourceType: options?.sourceType,
      inputSchema: options?.inputSchema ?? [],
      route: options?.route,
      requiredSkills: options?.requiredSkills ?? [],
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to queue node execution");
  }

  return response.json();
};

export const fetchInputProfiles = async (
  nodeId: string,
): Promise<{ defaultProfileId?: string; profiles: Array<{ id: string; name: string; values: Record<string, string> }> }> => {
  const response = await fetch(`/api/v1/input-profiles?nodeId=${encodeURIComponent(nodeId)}`);
  if (!response.ok) {
    throw new Error("Failed to load input profiles");
  }
  return response.json();
};

export const saveInputProfile = async (options: {
  nodeId: string;
  profileId?: string;
  name: string;
  values: Record<string, string>;
  setDefault?: boolean;
}): Promise<{ success: boolean; defaultProfileId?: string; profiles: Array<{ id: string; name: string; values: Record<string, string> }> }> => {
  const response = await fetch("/api/v1/input-profiles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to save input profile");
  }
  return response.json();
};

export const fetchControlPlaneState = async (): Promise<ControlPlaneState> => {
  const response = await fetch("/api/v1/control-plane/state");
  if (!response.ok) {
    throw new Error("Failed to load control-plane state");
  }
  return response.json();
};

export const updateAssetRoot = async (
  nextPath: string,
): Promise<{ success: boolean; assetRoot: AssetRootConfig }> => {
  const response = await fetch("/api/v1/control-plane/asset-root", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: nextPath }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to update asset root");
  }

  return response.json();
};

export const queueAssetIntake = async (options: {
  targetDir: string;
  archiveRule?: string;
  action: "organize" | "index" | "full";
}): Promise<{ success: boolean; queuedTasks: AgentTask[]; decisionSummary: string }> => {
  const response = await fetch("/api/v1/control-plane/asset-intake", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to queue asset intake");
  }

  return response.json();
};

export const createShortVideoSampleBatch = async (options: {
  platform: string;
  accountName: string;
  accountHandle?: string;
  objective?: string;
  sampleSize: number;
  targetMode?: string;
  batchId?: string;
  links: Array<{ platform?: string; url: string; note?: string }>;
}): Promise<{
  success: boolean;
  sampleManifest: string;
  sourceLinksCsv: string;
  executionSummary: string;
}> => {
  const response = await fetch("/api/v1/control-plane/short-video/sample-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to create short-video sample batch");
  }

  return response.json();
};

export const queueShortVideoAccountResearch = async (options: {
  manifestPath: string;
  apiKey?: string;
}): Promise<{ success: boolean; task: AgentTask; message: string }> => {
  const response = await fetch("/api/v1/control-plane/short-video/account-research", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to queue account research");
  }

  return response.json();
};

export const queueShortVideoCreativeBrief = async (options: {
  researchBundlePath: string;
  selectedContentIds?: string[];
  targetPlatform: string;
  targetGoal?: string;
  imitationStrategy?: string;
  tone?: string;
  durationTarget?: number;
}): Promise<{ success: boolean; task: AgentTask; message: string }> => {
  const response = await fetch("/api/v1/control-plane/short-video/creative-brief", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to queue creative brief");
  }

  return response.json();
};

export const queueShortVideoDirectorProduction = async (options: {
  creativeBriefPath: string;
  generateAiClips?: boolean;
}): Promise<{ success: boolean; task: AgentTask; message: string }> => {
  const response = await fetch("/api/v1/control-plane/short-video/director-production", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to queue director production");
  }

  return response.json();
};

export const queueNotebooklmAccountEnhance = async (options: {
  researchBundlePath: string;
  creativeBriefPath: string;
}): Promise<{ success: boolean; task: AgentTask; message: string }> => {
  const response = await fetch("/api/v1/control-plane/short-video/notebooklm-enhance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to queue NotebookLM enhancement");
  }

  return response.json();
};

export const searchStorageRetrieval = async (options: {
  query: string;
  scope: "all" | "assets" | "knowledge";
  type: string;
  platform: string;
  projectSeries?: string;
}): Promise<{ assets: any[]; knowledge: any[] }> => {
  const response = await fetch("/api/v1/storage-retrieval/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to search storage and retrieval workspace");
  }

  return response.json();
};

export const importStorageRetrieval = async (options: {
  pathEntries: string[];
  linkEntries: string[];
  note?: string;
  files: Array<{
    name: string;
    relativePath: string;
    contentBase64: string;
  }>;
}): Promise<{
  success: boolean;
  summary: string;
  manifestPath: string;
  knowledgeNotePath?: string;
  importedAt: string;
  items: Array<{
    source: string;
    sourceKind: "path" | "link" | "upload";
    classifiedAs: string;
    targetBucket: string;
    action: "copied" | "referenced";
    confidence: "high" | "medium" | "low";
    storedAt?: string;
    warning?: string;
  }>;
}> => {
  const response = await fetch("/api/v1/storage-retrieval/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to import items into storage and retrieval");
  }

  return response.json();
};

export const fetchStorageRetrievalRecent = async (): Promise<{
  imports: Array<{
    id: string;
    importedAt: string;
    manifestPath: string;
    knowledgeNotePath?: string;
    summary: string;
  }>;
}> => {
  const response = await fetch("/api/v1/storage-retrieval/recent");
  if (!response.ok) {
    throw new Error("Failed to load recent storage and retrieval activity");
  }
  return response.json();
};

export const reclassifyStorageRetrievalImportItem = async (options: {
  manifestPath: string;
  itemIndex: number;
  projectFolder: string;
  workflow: string;
  stage: string;
}): Promise<{
  success: boolean;
  summary: string;
  manifestPath: string;
  knowledgeNotePath?: string;
  importedAt: string;
  items: any[];
  updatedItem: any;
}> => {
  const response = await fetch("/api/v1/storage-retrieval/reclassify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to reclassify storage import item");
  }

  return response.json();
};

export const listLocalPackages = async (): Promise<{
  packages: InstalledCommunityPackage[];
}> => {
  const response = await fetch("/api/v1/local-packages");
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to load local packages");
  }
  return response.json();
};

export const inspectLocalPackage = async (options: {
  packagePath?: string;
  fileName?: string;
  contentBase64?: string;
}): Promise<CommunityPackageInspection> => {
  const response = await fetch("/api/v1/local-packages/inspect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to inspect local package");
  }

  return response.json();
};

export const installLocalPackage = async (options: {
  packagePath: string;
  distributionChannel?: string;
  releaseUrl?: string;
  sourceRepo?: string;
  sourceTag?: string;
}): Promise<{
  success: boolean;
  packageId: string;
  version: string;
  installPath: string;
}> => {
  const response = await fetch("/api/v1/local-packages/install", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to install local package");
  }

  return response.json();
};

export const enableLocalPackage = async (options: {
  packageId: string;
  version: string;
}): Promise<{ success: boolean }> => {
  const response = await fetch("/api/v1/local-packages/enable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to enable local package");
  }
  return response.json();
};

export const disableLocalPackage = async (options: {
  packageId: string;
  version: string;
}): Promise<{ success: boolean }> => {
  const response = await fetch("/api/v1/local-packages/disable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to disable local package");
  }
  return response.json();
};

export const rollbackLocalPackage = async (options: {
  packageId: string;
  targetVersion?: string;
}): Promise<{ success: boolean; activeVersion: string }> => {
  const response = await fetch("/api/v1/local-packages/rollback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to rollback local package");
  }
  return response.json();
};

export const uninstallLocalPackage = async (options: {
  packageId: string;
  version: string;
}): Promise<{ success: boolean }> => {
  const response = await fetch("/api/v1/local-packages/uninstall", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to uninstall local package");
  }
  return response.json();
};

export const queueSavedVideoInsightCapture = async (options: {
  videoUrl: string;
  objective?: string;
  reflectionNote?: string;
  collectionName?: string;
  apiKey?: string;
}): Promise<{ success: boolean; task: AgentTask; message: string }> => {
  const response = await fetch("/api/v1/control-plane/short-video/inspiration-capture", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to queue saved video insight capture");
  }

  return response.json();
};

export const applyDecisionAction = async (options: {
  decisionId: string;
  action: "ignore" | "snooze" | "resolve" | "retry-task";
  relatedTaskId?: string;
  note?: string;
}): Promise<{ success: boolean; task?: AgentTask; snoozeUntil?: string }> => {
  const response = await fetch("/api/v1/control-plane/decision-action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to apply decision action");
  }

  return response.json();
};

export const exportPortableBundle = async (
  nodeId: string,
): Promise<{ success: boolean; bundle: PortableBundleExport }> => {
  const response = await fetch("/api/v1/bundles/export", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ nodeId }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to export portable bundle");
  }

  const data = (await response.json()) as { success: boolean } & PortableBundleExport;
  return {
    success: data.success,
    bundle: {
      nodeId: data.nodeId,
      nodeLabel: data.nodeLabel,
      capabilityId: data.capabilityId,
      bundleDir: data.bundleDir,
      zipPath: data.zipPath,
      relativeZipPath: data.relativeZipPath,
      downloadUrl: data.downloadUrl,
      dependencies: data.dependencies,
      packagedCapabilities: data.packagedCapabilities,
    },
  };
};

export const openLocalPath = async (
  path: string,
  options?: { reveal?: boolean },
): Promise<{ success: boolean }> => {
  const response = await fetch("/api/v1/file/open", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path,
      reveal: options?.reveal ?? false,
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to open path");
  }

  return response.json();
};

export const submitTaskFeedback = async (
  taskId: string,
  feedback: string,
  options?: { sentiment?: "positive" | "negative" | "idea"; artifacts?: string[] },
): Promise<TaskFeedbackResult> => {
  const response = await fetch("/api/v1/task-feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      taskId,
      feedback,
      sentiment: options?.sentiment ?? "idea",
      artifacts: options?.artifacts ?? [],
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Failed to submit feedback");
  }

  return response.json();
};

export const fetchTaskHistory = async (
  options?: { offset?: number; limit?: number },
): Promise<TaskHistoryResponse> => {
  const params = new URLSearchParams();
  params.set("offset", String(options?.offset ?? 0));
  params.set("limit", String(options?.limit ?? 6));
  const response = await fetch(`/api/v1/task-history?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch task history");
  }

  return response.json();
};
