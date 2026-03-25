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
  | "short-video-sample-batch"
  | "short-video-account-research"
  | "short-video-creative-brief"
  | "short-video-director-production"
  | "short-video-insight-capture"
  | "notebooklm-account-enhance"
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
  | "sample-manifest-missing"
  | "platform-capture-failed"
  | "transcript-failed"
  | "director-brief-missing"
  | "gemini-consent-pending"
  | "notebooklm-optional-unavailable"
  | "notebook-missing"
  | "notebook-sync-failed"
  | "notebook-query-failed"
  | "videoagent-generation-failed"
  | "remotion-asset-gap"
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

export interface ShortVideoFactoryArtifact {
  label: string;
  path: string;
  updatedAt: string | null;
}

export interface ShortVideoFactoryGate {
  id: string;
  label: string;
  status: "pending" | "ready" | "blocked" | "completed";
  detail: string;
}

export interface ShortVideoFactoryState {
  defaultSeries: string;
  defaultInstance: string;
  minSampleSize: number;
  defaultSampleSize: number;
  latestSampleBatch: ShortVideoFactoryArtifact | null;
  latestResearchBundle: ShortVideoFactoryArtifact | null;
  latestCreativeBrief: ShortVideoFactoryArtifact | null;
  latestProductionPack: ShortVideoFactoryArtifact | null;
  latestRoughCut: ShortVideoFactoryArtifact | null;
  latestInspirationRecord: ShortVideoFactoryArtifact | null;
  latestNotebookSummary?: ShortVideoFactoryArtifact | null;
  latestNotebookEnhancedBrief?: ShortVideoFactoryArtifact | null;
  geminiConsentGranted: boolean;
  notebooklmAvailable: boolean;
  notebookStatus?: "unavailable" | "missing" | "notebook_created" | "sources_synced" | "nblm_summary_ready" | "enhanced_brief_ready";
  notebookSourceSyncAt?: string | null;
  notebookEnhancedBriefPath?: string | null;
  gates: ShortVideoFactoryGate[];
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
  shortVideoFactory: ShortVideoFactoryState;
}

export interface CommunityPackagePermission {
  key: string;
  required: boolean;
  reason: string;
}

export interface CommunityPackageDependency {
  id: string;
  label: string;
  kind: string;
  required: boolean;
  installCommand?: string;
  installUrl?: string;
  bundled?: boolean;
}

export type CommunityPackageOnboardingStepKind =
  | "permission"
  | "dependency"
  | "action"
  | "verification"
  | "docs";

export interface CommunityPackageOnboardingStep {
  id: string;
  title: string;
  description?: string;
  kind: CommunityPackageOnboardingStepKind;
  required: boolean;
  command?: string;
  installUrl?: string;
  docPath?: string;
}

export interface CommunityPackageOnboardingMetadata {
  available: boolean;
  source: "manifest" | "derived";
  title: string;
  description?: string;
  estimatedMinutes?: number;
  firstRunWizard: boolean;
  steps: CommunityPackageOnboardingStep[];
}

export interface CommunityPackageOnboardingState {
  phase: "not-required" | "inspect-ready" | "installed-pending" | "completed";
  completion: "not-started" | "in-progress" | "complete";
  totalSteps: number;
  requiredSteps: number;
  pendingRequiredSteps: number;
  nextStepId?: string;
}

export interface CommunityPackageManifest {
  schemaVersion: string;
  packageId: string;
  type: string;
  name: string;
  version: string;
  author: {
    name: string;
    id?: string;
    homepage?: string;
  };
  description: string;
  source?: {
    kind?: string;
    repository?: string;
    createdAt?: string;
  };
  capabilities: Array<{
    id: string;
    label: string;
    summary?: string;
    entrypoint?: string;
  }>;
  dependencies: CommunityPackageDependency[];
  compatibility: {
    openclawMinVersion: string;
    installMode: string;
    platforms?: string[];
  };
  permissions: CommunityPackagePermission[];
  checksums: {
    algorithm: string;
    files: Array<{ path: string; sha256: string }>;
    archive?: { path?: string; sha256?: string };
  };
  onboarding?: {
    title?: string;
    description?: string;
    estimatedMinutes?: number;
    firstRunWizard?: boolean;
    steps?: CommunityPackageOnboardingStep[];
  };
  docs: Array<{ title: string; path: string }>;
  assets: Array<{ path: string; kind: string; label?: string }>;
  reviewStatus: string;
  visibility: string;
}

export interface CommunityPackageInspection {
  success: boolean;
  packagePath: string;
  manifestSource: string;
  manifest: CommunityPackageManifest;
  validationIssues: string[];
  installPreview: {
    packageId: string;
    version: string;
    permissions: CommunityPackagePermission[];
    dependencies: CommunityPackageDependency[];
  };
  onboarding: CommunityPackageOnboardingMetadata;
  onboardingState: CommunityPackageOnboardingState;
}

export interface CommunityPackageInstallResult {
  success: boolean;
  packageId: string;
  version: string;
  installPath: string;
  onboarding: CommunityPackageOnboardingMetadata;
  onboardingState: CommunityPackageOnboardingState;
  installState: {
    installed: boolean;
    activeVersion?: string;
    versionStatus?: "enabled" | "disabled";
  };
}

export interface InstalledCommunityPackageVersion {
  version: string;
  status: "enabled" | "disabled";
  installedAt: string;
  installPath: string;
  sourcePath: string;
  manifestPath: string;
  distributionChannel?: string;
  releaseUrl?: string;
  sourceRepo?: string;
  sourceTag?: string;
  permissions: CommunityPackagePermission[];
  compatibility: CommunityPackageManifest["compatibility"];
}

export interface InstalledCommunityPackage {
  packageId: string;
  name: string;
  type: string;
  author: CommunityPackageManifest["author"];
  activeVersion: string;
  distributionChannel?: string;
  releaseUrl?: string;
  sourceRepo?: string;
  sourceTag?: string;
  installedVersions: InstalledCommunityPackageVersion[];
}
