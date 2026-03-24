export type DecisionPriority = "urgent" | "high" | "medium" | "low";

export type DecisionItem = {
  id: string;
  priority: DecisionPriority;
  reason: string;
  nextAction: string;
  refs?: string[];
  metadata?: Record<string, string>;
};

export type EvidenceState = {
  lastConfirmedAt?: string;
  lastCapturedAt?: string;
  needsRefresh?: boolean;
  summary?: string;
};

export type FailureClusterState = {
  id?: string;
  count?: number;
  latestError?: string;
  windowMinutes?: number;
};

export type FollowUpState = {
  queued?: boolean;
  reason?: string;
  owner?: string;
  eta?: string;
};

export type AssetState = {
  configured?: boolean;
  path?: string;
};

export type TaskState = {
  id?: string;
  title?: string;
  blocked?: boolean;
  blockReason?: string;
  assetState?: AssetState;
  evidence?: EvidenceState;
  failureCluster?: FailureClusterState;
  followUp?: FollowUpState;
};

export type KnowledgeState = {
  evidence?: EvidenceState;
  asset?: AssetState;
};

const STALE_EVIDENCE_MS = 1000 * 60 * 60 * 24;

function buildDecisionId(kind: string, taskId?: string) {
  return `${kind}:${taskId ?? Math.random().toString(36).slice(2, 8)}`;
}

function makeDecisionItem(input: {
  kind: string;
  priority: DecisionPriority;
  reason: string;
  nextAction: string;
  refs?: string[];
  metadata?: Record<string, string>;
}) {
  return {
    id: buildDecisionId(input.kind, input.refs?.[0]),
    priority: input.priority,
    reason: input.reason,
    nextAction: input.nextAction,
    refs: input.refs,
    metadata: input.metadata,
  };
}

function parseTimestamp(value?: string) {
  if (!value) {
    return null;
  }
  const numeric = Date.parse(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isEvidenceStale(evidence?: EvidenceState) {
  if (evidence?.needsRefresh) {
    return true;
  }
  const lastConfirmed = parseTimestamp(evidence?.lastConfirmedAt);
  if (!lastConfirmed) {
    return true;
  }
  return Date.now() - lastConfirmed > STALE_EVIDENCE_MS;
}

function buildBlockedDecision(task: TaskState): DecisionItem {
  const title = task.title ? `${task.title}` : "Unnamed task";
  const reason = task.blockReason
    ? `${title} is blocked: ${task.blockReason}`
    : `${title} is currently blocked.`;
  return makeDecisionItem({
    kind: "blocked",
    priority: "urgent",
    reason,
    nextAction: "Resolve blocker, escalate to the relevant owner, and unlock downstream steps.",
    refs: task.id ? [task.id] : undefined,
  });
}

function buildMissingAssetRootDecision(task: TaskState, knowledge: KnowledgeState): DecisionItem {
  const assetPath = task.assetState?.path ?? knowledge.asset?.path ?? "(not configured)";
  return makeDecisionItem({
    kind: "asset-root",
    priority: "high",
    reason: `Required asset root is missing or unverified (${assetPath}).`,
    nextAction: "Set or confirm the asset root before provisioning new artifacts.",
    refs: task.id ? [task.id] : undefined,
    metadata: { path: assetPath },
  });
}

function buildStaleEvidenceDecision(task: TaskState, knowledge: KnowledgeState): DecisionItem {
  const evidenceSource = task.evidence ?? knowledge.evidence;
  return makeDecisionItem({
    kind: "evidence-stale",
    priority: "high",
    reason: evidenceSource?.summary
      ? `Runtime evidence is stale: ${evidenceSource.summary}`
      : "Runtime evidence has not been confirmed recently.",
    nextAction: "Refresh or re-validate runtime evidence to regain confidence.",
    refs: task.id ? [task.id] : undefined,
  });
}

function buildFailureClusterDecision(task: TaskState): DecisionItem {
  const cluster = task.failureCluster;
  const count = cluster?.count ?? 0;
  const reason = cluster?.latestError
    ? `Failure cluster detected (${count} hits): ${cluster.latestError}`
    : `Failure cluster detected (${count} hits).`;
  return makeDecisionItem({
    kind: "failure-cluster",
    priority: "medium",
    reason,
    nextAction: "Investigate the recurring errors, pause automatic retries, and capture fresh diagnostics.",
    refs: cluster?.id ? [cluster.id] : task.id ? [task.id] : undefined,
    metadata: {
      count: `${count}`,
      windowMinutes: cluster?.windowMinutes?.toString() ?? "",
    },
  });
}

function buildFollowUpDecision(task: TaskState): DecisionItem {
  const followUp = task.followUp;
  const reason = followUp?.reason
    ? `Follow-up queued: ${followUp.reason}`
    : "Intake follow-up request is waiting.";
  return makeDecisionItem({
    kind: "follow-up",
    priority: "medium",
    reason,
    nextAction: "Engage the queued contact and log the outcome as soon as possible.",
    refs: task.id ? [task.id] : undefined,
    metadata: {
      owner: followUp?.owner ?? "",
      eta: followUp?.eta ?? "",
    },
  });
}

export function deriveDecisionQueue(
  task: TaskState = {},
  knowledge: KnowledgeState = {},
): DecisionItem[] {
  const decisions: DecisionItem[] = [];

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

export function summarizeDecisions(decisions: DecisionItem[]): string {
  if (!decisions.length) {
    return "Decision queue is clear.";
  }
  return decisions
    .map((decision) => `${decision.priority.toUpperCase()}: ${decision.reason}`)
    .join("; ");
}
