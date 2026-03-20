export type NodeStatus = "idle" | "running" | "error";
export type EvidenceLevel = "declared" | "runtime" | "confirmed";
export type SkillEvidenceLevel = EvidenceLevel | "explicit-text";
export type KnowledgeType =
  | "content-reference"
  | "skill-reference"
  | "sop-reference"
  | "agent-knowledge"
  | "case-study"
  | "runtime-lesson"
  | "feedback"
  | "qmd-result"
  | "asset-index";
export type KnowledgeSourceKind = "reference" | "runtime" | "feedback" | "index";
export type ExecutionMode =
  | "shell"
  | "slash"
  | "workflow"
  | "evolution"
  | "asset-organize"
  | "asset-index"
  | "unknown";
export type TaskStage =
  | "queued"
  | "claimed"
  | "validating-inputs"
  | "orchestrating"
  | "executing"
  | "writing-knowledge"
  | "completed"
  | "failed";
export type TaskBlockerKind =
  | "missing-inputs"
  | "invalid-target-path"
  | "permission-denied"
  | "timeout"
  | "openclaw-session-failure"
  | "process-error"
  | "qmd-update-warning"
  | "asset-root-missing"
  | "unknown";
export type DecisionPriority = "p0" | "p1" | "p2" | "p3";

export interface NamingRule {
  id: string;
  label: string;
  pattern: string;
  example: string;
}

export interface NamingContract {
  version: string;
  summary: string[];
  rules: NamingRule[];
}

export interface AssetRootConfig {
  path: string;
  configured: boolean;
  source: "default" | "saved";
  configPath: string;
  suggestedPath: string;
  legacyWorkspaceRoots: string[];
  namingContract: NamingContract;
}

export interface DecisionQueueRef {
  label: string;
  value: string;
  path?: string;
  url?: string;
}

export interface DecisionQueueItem {
  id: string;
  priority: DecisionPriority;
  title: string;
  reason: string;
  nextAction: string;
  status: "open" | "watch" | "resolved";
  evidenceLevel?: EvidenceLevel;
  relatedTaskId?: string;
  relatedNodeId?: string;
  refs?: DecisionQueueRef[];
}

export interface TaskBlocker {
  kind: TaskBlockerKind;
  summary: string;
  detail?: string;
  nextAction?: string;
  evidenceLevel?: EvidenceLevel;
}

export interface TaskDecisionState {
  status: "clear" | "watch" | "attention";
  priority: DecisionPriority;
  reason: string;
  nextAction: string;
}

export interface SkillModule {
  id: string;
  label: string;
  summary: string;
  installed: boolean;
  installCommand?: string;
  installUrl?: string;
  sourcePath?: string;
  sourceType: "skill" | "foundation" | "integration" | "sop";
  capabilities?: string[];
  evidence?: SkillEvidenceLevel;
}

export interface AgentRoute {
  orchestrator: string;
  preferredAgents: string[];
  reason: string;
}

export interface SkillNode {
  id: string;
  level: 1 | 2 | 3;
  label: string;
  status: NodeStatus;
  parentId: string | null;
  sourceType?: "content-system" | "skill" | "sop" | "mock";
  sourcePath?: string;
  subtitle?: string;
  childCount?: number;
  drawerContent?: {
    summary?: string;
    prerequisites?: string;
    minimumSkillsNote?: string;
    route?: AgentRoute;
    capabilities: string[];
    useCases: { title: string; summary: string }[];
    inputs: {
      field: string;
      type: "text" | "slider";
      placeholder?: string;
      required?: boolean;
      defaultValue?: string;
    }[];
    invoke?: string;
    commands?: string[];
    requiredSkills?: SkillModule[];
    knowledgeBase?: {
      tags: string[];
      documents: { title: string; url: string }[];
    };
  };
}

export interface KnowledgeItem {
  id: string;
  evidenceLevel?: EvidenceLevel;
  knowledgeType?: KnowledgeType;
  sourceKind?: KnowledgeSourceKind;
  updatedAt?: string;
  human: {
    title: string;
    summary: string;
    content_md: string;
    tags: string[];
    domain: string;
    platform: string;
    links?: { title: string; url: string }[];
    examples?: { title: string; summary: string; url?: string }[];
  };
  machine: {
    intent: string;
    entities: Record<string, unknown>;
    steps: string[];
    commands: string[];
    constraints: string[];
    trigger?: { type: "cron" | "event"; schedule?: string };
  };
}

export type AgentTaskStatus =
  | "queued"
  | "claimed"
  | "running"
  | "completed"
  | "failed";

export interface AgentTask {
  id: string;
  nodeId: string;
  nodeLabel: string;
  familyId?: string;
  familyLabel?: string;
  command: string;
  executionMode?: ExecutionMode;
  status: AgentTaskStatus;
  stage?: TaskStage;
  evidenceLevel?: EvidenceLevel;
  artifactRefs?: TaskArtifact[];
  blocker?: TaskBlocker;
  decisionState?: TaskDecisionState;
  createdAt: number;
  updatedAt: number;
  agentId: string | null;
  resultSummary?: string;
  resultDetail?: string;
  context?: {
    sourcePath?: string;
    sourceType?: SkillNode["sourceType"];
    inputValues?: Record<string, string>;
    inputSchema?: NonNullable<SkillNode["drawerContent"]>["inputs"];
    requiredSkills?: SkillModule[];
    route?: AgentRoute;
    feedbackPath?: string;
    evolutionPath?: string;
    originalTaskId?: string;
    originalResultSummary?: string;
    originalResultDetail?: string;
    artifactPaths?: string[];
    targetDir?: string;
    archiveRule?: string;
    assetRootPath?: string;
  };
}

export interface AgentStatus {
  id: string | null;
  online: boolean;
  lastSeenAt: number | null;
}

export interface PortableBundleExport {
  nodeId: string;
  nodeLabel: string;
  capabilityId: string;
  bundleDir: string;
  zipPath: string;
  relativeZipPath: string;
  downloadUrl: string;
  dependencies: string[];
  packagedCapabilities: string[];
}

export interface TaskArtifact {
  path: string;
  label: string;
  key: string;
  primary?: boolean;
}

export interface TaskFeedbackResult {
  success: boolean;
  summary: string;
  feedbackPath: string;
  evolutionPath: string;
  suggestions: string[];
  evolutionTaskId?: string;
}

export interface HeartbeatPayload {
  status: "alive" | "waiting-for-agent";
  timestamp: number;
  agent: AgentStatus;
  activeTasks: AgentTask[];
  queuedTasks: AgentTask[];
  recentTasks: AgentTask[];
  decisionQueue?: DecisionQueueItem[];
}

export interface SkillTreeResponse {
  nodes: SkillNode[];
  source: string;
}

export interface TaskHistoryGroup {
  familyId: string;
  familyLabel: string;
  nodeId: string;
  latestUpdatedAt: number;
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  tasks: AgentTask[];
}

export interface TaskHistoryResponse {
  groups: TaskHistoryGroup[];
  nextOffset: number | null;
  hasMore: boolean;
  totalGroups: number;
}

export interface ControlPlaneState {
  assetRoot: AssetRootConfig;
  decisionQueue: DecisionQueueItem[];
}
