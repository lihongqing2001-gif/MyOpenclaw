import React, { Suspense, startTransition, useCallback, useEffect, useState } from "react";
import { TaskFeedbackModal } from "./components/TaskFeedbackModal";
import { DecisionQueuePanel } from "./components/DecisionQueuePanel";
import {
  AgentTask,
  ControlPlaneState,
  EvidenceLevel,
  HeartbeatPayload,
  KnowledgeItem,
  TaskFeedbackResult,
  TaskHistoryGroup,
} from "./types";
import {
  Terminal,
  Sun,
  Moon,
  Activity,
  ArrowLeft,
  FolderOpen,
  FolderSearch,
  MessageSquarePlus,
  FileText,
  Sparkles,
  ChevronDown,
  Clapperboard,
  Search,
  Clock3,
  BookOpenText,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  fetchControlPlaneState,
  createShortVideoSampleBatch,
  fetchTaskHistory,
  openLocalPath,
  queueShortVideoAccountResearch,
  queueShortVideoCreativeBrief,
  queueShortVideoDirectorProduction,
  queueNotebooklmAccountEnhance,
  queueSavedVideoInsightCapture,
  applyDecisionAction,
  queueAssetIntake,
  searchKnowledge,
  submitTaskFeedback,
  subscribeToKnowledgeStream,
  subscribeToStream,
  updateAssetRoot,
} from "./services/api";
import { useI18n } from "./i18n";
import { extractTaskArtifacts } from "./utils/taskArtifacts";

const loadSkillTreeView = () => import("./components/SkillTreeView");
const loadStorageRetrievalWorkspace = () =>
  import("./components/StorageRetrievalWorkspace").then((module) => ({ default: module.StorageRetrievalWorkspace }));
const loadAssetIntakePanel = () =>
  import("./components/AssetIntakePanel").then((module) => ({ default: module.AssetIntakePanel }));
const loadShortVideoFactoryPanel = () =>
  import("./components/ShortVideoFactoryPanel").then((module) => ({ default: module.ShortVideoFactoryPanel }));
const loadEvidenceSearchPanel = () =>
  import("./components/EvidenceSearchPanel").then((module) => ({ default: module.EvidenceSearchPanel }));
const loadTaskHistoryWorkspace = () =>
  import("./components/TaskHistoryWorkspace").then((module) => ({ default: module.TaskHistoryWorkspace }));
const loadCommunityPackagesWorkspace = () =>
  import("./components/CommunityPackagesWorkspace").then((module) => ({ default: module.CommunityPackagesWorkspace }));
const SkillTreeView = React.lazy(loadSkillTreeView);
const StorageRetrievalWorkspace = React.lazy(loadStorageRetrievalWorkspace);
const AssetIntakePanel = React.lazy(loadAssetIntakePanel);
const ShortVideoFactoryPanel = React.lazy(loadShortVideoFactoryPanel);
const EvidenceSearchPanel = React.lazy(loadEvidenceSearchPanel);
const TaskHistoryWorkspace = React.lazy(loadTaskHistoryWorkspace);
const CommunityPackagesWorkspace = React.lazy(loadCommunityPackagesWorkspace);

const prefersLightScheme = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches;
};

const formatTaskTime = (
  timestamp: number,
  t: (key: string, vars?: Record<string, string | number>) => string,
) => {
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (deltaSeconds < 5) {
    return t("time.justNow");
  }
  if (deltaSeconds < 60) {
    return t("time.secondsAgo", { count: deltaSeconds });
  }
  const deltaMinutes = Math.floor(deltaSeconds / 60);
  if (deltaMinutes < 60) {
    return t("time.minutesAgo", { count: deltaMinutes });
  }
  return t("time.hoursAgo", { count: Math.floor(deltaMinutes / 60) });
};

const decisionPriorityNumber = (priority: string) => {
  if (priority === "p0") {
    return 1;
  }
  if (priority === "p1") {
    return 2;
  }
  if (priority === "p2") {
    return 4;
  }
  return 6;
};

const mapKnowledgeToEvidenceResult = (item: KnowledgeItem) => {
  const docLink = item.human.links?.find((link) =>
    link.url.startsWith("/api/v1/doc?path="),
  );

  return {
    id: item.id,
    title: item.human.title,
    level: (item.evidenceLevel ?? "declared") as "confirmed" | "runtime" | "declared",
    source: item.sourceKind ?? item.human.platform,
    type: item.knowledgeType ?? item.human.domain,
    summary: item.human.summary,
    path: docLink
      ? decodeURIComponent(docLink.url.replace("/api/v1/doc?path=", ""))
      : undefined,
    link: item.human.links?.[0]?.url,
  };
};

const TaskRow = ({
  task,
  tone,
  onOpenPath,
  onFeedback,
  isHighlighted,
}: {
  task: AgentTask;
  tone: "running" | "queued" | "recent";
  onOpenPath?: (path: string, options?: { reveal?: boolean }) => void;
  onFeedback?: (task: AgentTask) => void;
  isHighlighted?: boolean;
}) => {
  const { t } = useI18n();
  const artifacts = extractTaskArtifacts(task);
  const primaryArtifact = artifacts.find((item) => item.primary) ?? artifacts[0];
  const knowledgeNote = artifacts.find((item) => item.key === "knowledge_note");
  const localizeBadge = (value: string) => {
    const maps: Record<string, string> = {
      "asset-organize": t("task.badge.execution.assetOrganize"),
      "asset-index": t("task.badge.execution.assetIndex"),
      "short-video-account-research": t("task.badge.execution.shortVideoResearch"),
      "short-video-creative-brief": t("task.badge.execution.shortVideoBrief"),
      "short-video-director-production": t("task.badge.execution.shortVideoProduction"),
      "notebooklm-account-enhance": t("task.badge.execution.notebooklmEnhance"),
      shell: t("task.badge.execution.shell"),
      slash: t("task.badge.execution.slash"),
      workflow: t("task.badge.execution.workflow"),
      evolution: t("task.badge.execution.evolution"),
      queued: t("task.badge.stage.queued"),
      claimed: t("task.badge.stage.claimed"),
      executing: t("task.badge.stage.executing"),
      completed: t("task.badge.stage.completed"),
      failed: t("task.badge.stage.failed"),
      runtime: t("decisionQueue.evidence.runtime"),
      declared: t("decisionQueue.evidence.declared"),
      confirmed: t("decisionQueue.evidence.confirmed"),
    };
    return maps[value] ?? value;
  };

  return (
    <div
      className="px-3 py-3 rounded-lg border gap-3"
      style={{
        backgroundColor: isHighlighted ? "var(--bg-secondary)" : "var(--bg-primary)",
        borderColor: isHighlighted ? "var(--node-run-border)" : "var(--border-color)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full mt-1.5 ${tone === "running" ? "animate-pulse" : ""}`}
            style={{
              backgroundColor:
                tone === "running"
                  ? "var(--node-run-text)"
                  : tone === "queued"
                    ? "var(--text-secondary)"
                    : task.status === "failed"
                      ? "var(--node-err-text)"
                      : "var(--text-secondary)",
            }}
          />
          <div className="min-w-0">
            <div
              className="text-xs font-medium truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {task.nodeLabel}
            </div>
        <div
          className="text-[10px] truncate mt-0.5"
          style={{ color: "var(--text-secondary)" }}
        >
          {task.command}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {task.executionMode && (
            <span
              className="rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase"
              style={{
                borderColor: "var(--border-color)",
                color: "var(--text-secondary)",
                backgroundColor: "var(--bg-secondary)",
              }}
            >
              {localizeBadge(task.executionMode)}
            </span>
          )}
          {task.stage && (
            <span
              className="rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase"
              style={{
                borderColor: "var(--border-color)",
                color: "var(--text-secondary)",
                backgroundColor: "var(--bg-secondary)",
              }}
            >
              {localizeBadge(task.stage)}
            </span>
          )}
          {task.evidenceLevel && (
            <span
              className="rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase"
              style={{
                borderColor:
                  task.evidenceLevel === "confirmed"
                    ? "rgba(52, 211, 153, 0.45)"
                    : task.evidenceLevel === "runtime"
                      ? "var(--node-run-border)"
                      : "var(--border-color)",
                color:
                  task.evidenceLevel === "confirmed"
                    ? "#34D399"
                    : task.evidenceLevel === "runtime"
                      ? "var(--node-run-text)"
                      : "var(--text-secondary)",
                backgroundColor: "var(--bg-secondary)",
              }}
            >
              {localizeBadge(task.evidenceLevel)}
            </span>
          )}
        </div>
          {task.context?.route && (
            <div
              className="text-[10px] mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("task.route", {
                route: `${task.context.route.orchestrator} -> ${task.context.route.preferredAgents.join(", ")}`,
              })}
            </div>
          )}
          {task.blocker && (
            <div
              className="text-[10px] mt-1"
              style={{ color: "var(--node-err-text)" }}
            >
              {t("task.blocker", { summary: task.blocker.summary })}
            </div>
          )}
          {task.decisionState && (
            <div
              className="text-[10px] mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("task.next", { next: task.decisionState.nextAction })}
            </div>
          )}
          {task.resultSummary && tone === "recent" && (
            <div
              className="text-[10px] mt-1 leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {task.resultSummary}
              </div>
            )}
          </div>
        </div>
        <span
          className="text-[10px] font-mono shrink-0"
          style={{ color: "var(--text-secondary)" }}
        >
          {tone === "queued" ? t("task.status.queued") : formatTaskTime(task.updatedAt, t)}
        </span>
      </div>

      {tone === "recent" && (primaryArtifact || knowledgeNote || onFeedback) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {primaryArtifact && onOpenPath && (
            <>
              <button
                type="button"
                onClick={() => onOpenPath(primaryArtifact.path)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-primary)",
                }}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                {t("task.actions.openResult")}
              </button>
              <button
                type="button"
                onClick={() => onOpenPath(primaryArtifact.path, { reveal: true })}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-primary)",
                }}
              >
                <FolderSearch className="w-3.5 h-3.5" />
                {t("task.actions.reveal")}
              </button>
            </>
          )}

          {knowledgeNote && onOpenPath && (
            <button
              type="button"
              onClick={() => onOpenPath(knowledgeNote.path)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold"
              style={{
                backgroundColor: "var(--bg-secondary)",
                borderColor: "var(--border-color)",
                color: "var(--text-primary)",
              }}
            >
              <FileText className="w-3.5 h-3.5" />
              {t("task.actions.openNote")}
            </button>
          )}

          {onFeedback && (
            <button
              type="button"
              onClick={() => onFeedback(task)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold"
              style={{
                backgroundColor: "var(--bg-secondary)",
                borderColor: "var(--border-color)",
                color: "var(--text-primary)",
              }}
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              {t("task.actions.feedback")}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const EmptyTaskState = ({ label }: { label: string }) => (
  <div
    className="px-3 py-3 rounded-lg border text-[11px]"
    style={{
      backgroundColor: "var(--bg-primary)",
      borderColor: "var(--border-color)",
      color: "var(--text-secondary)",
    }}
  >
    {label}
  </div>
);

const TaskHistoryGroupCard = ({
  group,
  onOpenPath,
  onFeedback,
}: {
  group: TaskHistoryGroup;
  onOpenPath: (path: string, options?: { reveal?: boolean }) => void;
  onFeedback: (task: AgentTask) => void;
}) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const latestTask = group.tasks[0];

  return (
    <div
      className="rounded-xl border"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-color)",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full px-3 py-3 text-left flex items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <div
            className="text-xs font-semibold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {group.familyLabel}
          </div>
          <div
            className="mt-1 text-[10px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("task.history.summary", {
              total: group.totalRuns,
              completed: group.completedRuns,
              failed: group.failedRuns,
            })}
          </div>
          {latestTask?.resultSummary && (
            <div
              className="mt-1 text-[10px] line-clamp-2"
              style={{ color: "var(--text-secondary)" }}
            >
              {latestTask.resultSummary}
            </div>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          style={{ color: "var(--text-secondary)" }}
        />
      </button>

      {expanded && (
        <div
          className="px-3 pb-3 space-y-2 border-t"
          style={{ borderColor: "var(--border-color)" }}
        >
          {group.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              tone="recent"
              onOpenPath={onOpenPath}
              onFeedback={onFeedback}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const QuickGuideModal = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const { t } = useI18n();

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-6 top-20 w-[min(28rem,calc(100vw-2rem))] rounded-[1.5rem] border shadow-2xl backdrop-blur-xl"
        style={{
          background: "var(--panel-surface)",
          borderColor: "var(--border-color)",
        }}
      >
        <div
          className="px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {t("dashboard.guide.title")}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border px-3 py-1 text-[11px]"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderColor: "var(--border-color)",
              color: "var(--text-primary)",
            }}
          >
            {t("common.close")}
          </button>
        </div>
        <div className="p-5 space-y-3">
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="rounded-xl border px-4 py-4 text-[12px] leading-relaxed"
              style={{
                background: "var(--panel-surface-soft)",
                borderColor: "var(--border-color)",
                color: "var(--text-secondary)",
              }}
            >
              {t(`dashboard.guide.line${index}`)}
            </div>
          ))}
          <div
            className="rounded-xl border px-4 py-4 text-[12px] leading-relaxed"
            style={{
              background: "var(--panel-surface-soft)",
              borderColor: "var(--border-color)",
              color: "var(--text-secondary)",
            }}
          >
            {t("dashboard.workspace.tipBody")}
          </div>
          <div
            className="rounded-xl border px-4 py-4 text-[12px] leading-relaxed"
            style={{
              background: "var(--panel-surface-soft)",
              borderColor: "var(--border-color)",
              color: "var(--text-secondary)",
            }}
          >
            {t("dashboard.source", { source: t("dashboard.source.workspace") })}
          </div>
        </div>
      </div>
    </div>
  );
};

const ConsoleStatusCard = ({
  heartbeat,
  onOpenTree,
  onOpenGuide,
  onPreloadTree,
}: {
  heartbeat: HeartbeatPayload | null;
  onOpenTree: () => void;
  onOpenGuide: () => void;
  onPreloadTree: () => void;
}) => {
  const { t } = useI18n();

  return (
    <div
      className="w-full rounded-[1.35rem] border px-4 py-4 shadow-sm"
      style={{
        background: "var(--panel-surface)",
        borderColor: "var(--border-color)",
        boxShadow: "var(--panel-shadow)",
      }}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.22em]"
            style={{
              backgroundColor: "rgba(255,255,255,0.03)",
              borderColor: heartbeat?.agent.online
                ? "var(--node-run-border)"
                : "var(--node-err-border)",
              color: heartbeat?.agent.online
                ? "var(--node-run-text)"
                : "var(--node-err-text)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: heartbeat?.agent.online
                  ? "var(--node-run-edge)"
                  : "var(--node-err-text)",
              }}
            />
            {heartbeat?.agent.online
              ? t("header.status.linked")
              : t("header.status.waiting")}
          </div>
          <h2
            className="text-[1.15rem] font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            SoloCore Console
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div
            className="rounded-2xl border px-3 py-3"
            style={{
              borderColor: "var(--border-color)",
              backgroundColor: "var(--bg-secondary)",
            }}
          >
            <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-secondary)" }}>
              {t("dashboard.console.active")}
            </div>
            <div className="mt-1 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              {heartbeat?.activeTasks.length ?? 0}
            </div>
          </div>
          <div
            className="rounded-2xl border px-3 py-3"
            style={{
              borderColor: "var(--border-color)",
              backgroundColor: "var(--bg-secondary)",
            }}
          >
            <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-secondary)" }}>
              {t("dashboard.console.latest")}
            </div>
            <div className="mt-1 text-[12px] font-semibold line-clamp-2" style={{ color: "var(--text-primary)" }}>
              {heartbeat?.recentTasks?.[0]?.nodeLabel ?? t("dashboard.console.none")}
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <button
            type="button"
            onClick={onOpenTree}
            onMouseEnter={onPreloadTree}
            onFocus={onPreloadTree}
            aria-label={t("dashboard.enterTree")}
            className="rounded-[1.1rem] border px-4 py-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--node-run-edge)]"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderColor: "var(--border-color)",
            }}
          >
            <div
              className="text-[10px] uppercase tracking-[0.2em]"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("dashboard.hero.primaryAction")}
            </div>
            <div
              className="mt-2 text-base font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {t("dashboard.enterTree")}
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenGuide}
            className="rounded-[1.1rem] border px-4 py-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderColor: "var(--border-color)",
            }}
          >
            <div
              className="text-[10px] uppercase tracking-[0.2em]"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("dashboard.hero.help")}
            </div>
            <div
              className="mt-2 text-base font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {t("dashboard.guide.title")}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

const GlobalTaskPanel = ({
  heartbeat,
  onOpenPath,
  onFeedback,
  highlightedTaskId,
}: {
  heartbeat: HeartbeatPayload | null;
  onOpenPath: (path: string, options?: { reveal?: boolean }) => void;
  onFeedback: (task: AgentTask) => void;
  highlightedTaskId?: string | null;
}) => {
  const { t } = useI18n();
  const activeTasks = heartbeat?.activeTasks ?? [];
  const queuedTasks = heartbeat?.queuedTasks ?? [];
  const latestRecentTask = heartbeat?.recentTasks?.[0] ?? null;

  return (
    <div
      data-testid="global-task-panel"
      className="w-full rounded-xl border shadow-sm overflow-hidden"
      style={{
        background: "var(--panel-surface)",
        borderColor: "var(--border-color)",
      }}
    >
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center gap-2">
          <Activity
            className="w-4 h-4"
            style={{ color: "var(--node-run-text)" }}
          />
          <span
            className="text-xs font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {t("dashboard.tasks.runtimeTitle")}
          </span>
        </div>
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-secondary)",
          }}
        >
          {t("dashboard.tasks.live", {
            count: activeTasks.length + queuedTasks.length,
          })}
        </span>
      </div>
      <div className="p-3 space-y-2">
        <div
          className="px-3 py-2 rounded-lg border flex items-center justify-between"
          style={{
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--border-color)",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: heartbeat?.agent.online
                  ? "var(--node-run-text)"
                  : "var(--node-err-text)",
              }}
            />
            <span
              className="text-xs font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {heartbeat?.agent.online
                ? t("dashboard.tasks.agent.online")
                : t("dashboard.tasks.agent.waiting")}
            </span>
          </div>
          <span
            className="text-[10px] font-mono"
            style={{ color: "var(--text-secondary)" }}
          >
            {heartbeat?.agent.lastSeenAt
              ? formatTaskTime(heartbeat.agent.lastSeenAt, t)
              : t("dashboard.tasks.offline")}
          </span>
        </div>

        <div
          className="text-[10px] font-semibold uppercase tracking-wider mb-1"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("dashboard.tasks.running")}
        </div>
        {activeTasks.length > 0 ? (
          activeTasks.map((task) => (
            <div key={task.id}>
              <TaskRow
                task={task}
                tone="running"
                onOpenPath={onOpenPath}
                onFeedback={onFeedback}
                isHighlighted={highlightedTaskId === task.id}
              />
            </div>
          ))
        ) : (
          <EmptyTaskState label={t("dashboard.tasks.empty.running")} />
        )}

        <div
          className="text-[10px] font-semibold uppercase tracking-wider mt-3 mb-1"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("dashboard.tasks.queued")}
        </div>
        {queuedTasks.length > 0 ? (
          queuedTasks.map((task) => (
            <div key={task.id}>
              <TaskRow
                task={task}
                tone="queued"
                onOpenPath={onOpenPath}
                onFeedback={onFeedback}
                isHighlighted={highlightedTaskId === task.id}
              />
            </div>
          ))
        ) : (
          <EmptyTaskState label={t("dashboard.tasks.empty.queue")} />
        )}

        {activeTasks.length === 0 && queuedTasks.length === 0 ? (
          <div
            className="mt-3 rounded-lg border px-3 py-3 text-[11px]"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderColor: "var(--border-color)",
              color: "var(--text-secondary)",
            }}
          >
            <p style={{ color: "var(--text-primary)" }}>
              {t("dashboard.tasks.idle.title")}
            </p>
            <p className="mt-1">{t("dashboard.tasks.idle.body")}</p>
            {latestRecentTask && (
              <button
                type="button"
                onClick={() => onFeedback(latestRecentTask)}
                className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-primary)",
                }}
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                {t("dashboard.tasks.idle.reviewLatest")}
              </button>
            )}
          </div>
        ) : (
          latestRecentTask && (
            <div
              className="mt-3 rounded-lg border px-3 py-3"
              style={{
                backgroundColor: "var(--bg-primary)",
                borderColor: "var(--border-color)",
              }}
            >
              <div
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("dashboard.tasks.latestAction")}
              </div>
              <div
                className="mt-2 text-xs font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {latestRecentTask.nodeLabel}
              </div>
              <div
                className="mt-1 text-[11px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {latestRecentTask.resultSummary}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};

const DashboardWorkspacePanel = ({
  heartbeat,
  onOpenPath,
  onFeedback,
}: {
  heartbeat: HeartbeatPayload | null;
  onOpenPath: (path: string, options?: { reveal?: boolean }) => void;
  onFeedback: (task: AgentTask) => void;
}) => {
  const { t } = useI18n();
  const recentTask = heartbeat?.recentTasks?.[0] ?? null;
  const artifacts = recentTask ? extractTaskArtifacts(recentTask) : [];
  const primaryArtifact = artifacts.find((item) => item.primary) ?? artifacts[0] ?? null;
  const noteArtifact = artifacts.find((item) => item.key === "knowledge_note") ?? null;
  const [historyGroups, setHistoryGroups] = useState<TaskHistoryGroup[]>([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const refreshHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const response = await fetchTaskHistory({ offset: 0, limit: 6 });
      setHistoryGroups(response.groups);
      setHistoryOffset(response.nextOffset ?? 0);
      setHistoryHasMore(response.hasMore);
    } catch (error) {
      console.error("Failed to load task history", error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadMoreHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const response = await fetchTaskHistory({ offset: historyOffset, limit: 6 });
      setHistoryGroups((current) => [...current, ...response.groups]);
      setHistoryOffset(response.nextOffset ?? 0);
      setHistoryHasMore(response.hasMore);
    } catch (error) {
      console.error("Failed to load task history", error);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyOffset]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory, heartbeat?.recentTasks?.[0]?.id, heartbeat?.recentTasks?.[0]?.updatedAt]);

  return (
    <div
      className="h-full border-b md:border-b-0 md:border-r p-4 md:p-8 flex flex-col gap-4 md:gap-6 overflow-visible md:overflow-y-auto"
      style={{
        borderColor: "var(--border-color)",
        background:
          "radial-gradient(circle at top left, rgba(93,183,255,0.12), transparent 38%), linear-gradient(180deg, var(--bg-secondary), var(--bg-primary))",
      }}
    >
      <div className="space-y-4 md:space-y-5">
        <div
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]"
          style={{
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--border-color)",
            color: "var(--text-secondary)",
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {t("dashboard.workspace.title")}
        </div>

        <div>
          <h2
            className="text-[1.45rem] md:text-[1.7rem] font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {t("dashboard.workspace.heading")}
          </h2>
        </div>

        <div
          className="rounded-[1.4rem] border px-4 py-4 space-y-3"
          style={{
            background: "var(--panel-surface-soft)",
            borderColor: "var(--border-color)",
          }}
        >
          <div
            className="text-[11px] uppercase tracking-[0.18em]"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("dashboard.workspace.latest")}
          </div>

          {recentTask ? (
            <>
              <div
                className="text-base font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {recentTask.nodeLabel}
              </div>
              <div
                className="text-[12px] leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {recentTask.resultSummary || recentTask.command}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {primaryArtifact && (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenPath(primaryArtifact.path)}
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold"
                      style={{
                        backgroundColor: "var(--bg-secondary)",
                        borderColor: "var(--border-color)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      {t("task.actions.openResult")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenPath(primaryArtifact.path, { reveal: true })}
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold"
                      style={{
                        backgroundColor: "var(--bg-secondary)",
                        borderColor: "var(--border-color)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <FolderSearch className="w-3.5 h-3.5" />
                      {t("task.actions.reveal")}
                    </button>
                  </>
                )}
                {noteArtifact && (
                  <button
                    type="button"
                    onClick={() => onOpenPath(noteArtifact.path)}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      borderColor: "var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {t("task.actions.openNote")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onFeedback(recentTask)}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  {t("task.actions.feedback")}
                </button>
              </div>
            </>
          ) : (
            <div
              className="text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("dashboard.workspace.empty")}
            </div>
          )}
        </div>

        <div
          className="rounded-[1.4rem] border px-4 py-4 space-y-3"
          style={{
            background: "var(--panel-surface-soft)",
            borderColor: "var(--border-color)",
          }}
        >
          <div
            className="text-[11px] uppercase tracking-[0.18em]"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("dashboard.workspace.history")}
          </div>
          <div className="space-y-2">
            {historyGroups.map((group) => (
              <TaskHistoryGroupCard
                key={group.familyId}
                group={group}
                onOpenPath={onOpenPath}
                onFeedback={onFeedback}
              />
            ))}
          </div>
          {historyHasMore && (
            <button
              type="button"
              onClick={loadMoreHistory}
              disabled={historyLoading}
              className="w-full rounded-xl border px-3 py-2 text-[11px] font-medium"
              style={{
                backgroundColor: "var(--bg-secondary)",
                borderColor: "var(--border-color)",
                color: "var(--text-primary)",
              }}
            >
              {historyLoading
                ? t("dashboard.workspace.historyLoading")
                : t("dashboard.workspace.historyMore")}
            </button>
          )}
        </div>
      </div>

    </div>
  );
};

const Flow = () => {
  const { language, setLanguage, t } = useI18n();
  const [isLightMode, setIsLightMode] = useState(() => prefersLightScheme());
  const [currentView, setCurrentView] = useState<"dashboard" | "skillTree">(
    "dashboard",
  );
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  const [heartbeat, setHeartbeat] = useState<HeartbeatPayload | null>(null);
  const [controlPlaneState, setControlPlaneState] = useState<ControlPlaneState | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [feedbackTask, setFeedbackTask] = useState<AgentTask | null>(null);
  const [feedbackResult, setFeedbackResult] = useState<TaskFeedbackResult | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [decisionActionId, setDecisionActionId] = useState<string | null>(null);
  const [targetDirectory, setTargetDirectory] = useState("");
  const [archiveRuleNote, setArchiveRuleNote] = useState("");
  const [intakeLoadingAction, setIntakeLoadingAction] = useState<"organize" | "index" | "fullIntake" | null>(null);
  const [intakeErrorMessage, setIntakeErrorMessage] = useState<string | undefined>();
  const [intakeLastActionMessage, setIntakeLastActionMessage] = useState<string | undefined>();
  const [evidenceQuery, setEvidenceQuery] = useState("");
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceResults, setEvidenceResults] = useState<KnowledgeItem[]>([]);
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceLevel | "all">("all");
  const [shortVideoLoadingAction, setShortVideoLoadingAction] = useState<
    "batch" | "research" | "brief" | "production" | "insight" | "notebooklm" | null
  >(null);
  const [shortVideoErrorMessage, setShortVideoErrorMessage] = useState<string | undefined>();
  const [shortVideoSuccessMessage, setShortVideoSuccessMessage] = useState<string | undefined>();
  const [shortVideoSampleBatchForm, setShortVideoSampleBatchForm] = useState({
    platform: "mixed",
    accountName: "",
    accountHandle: "",
    objective: "建立对标账号样本批次并进入短视频资产工厂",
    sampleSize: 5,
    linksText: "",
  });
  const [shortVideoCreativeForm, setShortVideoCreativeForm] = useState({
    selectedContentIds: "",
    targetPlatform: "douyin",
    targetGoal: "产出口播优先的短视频创作包",
    imitationStrategy: "结构模仿",
    tone: "真诚、克制、带一点情绪张力",
    durationTarget: 35,
    generateAiClips: false,
  });
  const [shortVideoInsightForm, setShortVideoInsightForm] = useState({
    videoUrl: "",
    objective: "把收藏视频沉淀成可阅读、可检索、可继续提问的洞察记录",
    reflectionNote: "",
    collectionName: "收藏视频",
  });
  const [decisionFocusTarget, setDecisionFocusTarget] = useState<
    "tasks" | "asset-intake" | "evidence-search" | "workspace" | "short-video-factory" | null
  >(null);
  const [activeControlModule, setActiveControlModule] = useState<
    "task-history" | "storage-retrieval" | "community-packages" | "short-video-factory"
  >("task-history");
  const [storageRetrievalTab, setStorageRetrievalTab] = useState<"import" | "search" | "recent" | "settings">("import");

  const assetPanelId = "asset-intake-panel";
  const evidencePanelId = "evidence-search-panel";
  const workspacePanelId = "workspace-panel";
  const shortVideoPanelId = "short-video-factory-panel";
  const preloadWorkspaceModule = useCallback(
    (module: "task-history" | "storage-retrieval" | "community-packages" | "short-video-factory") => {
      if (module === "task-history") {
        void loadTaskHistoryWorkspace();
        return;
      }
      if (module === "short-video-factory") {
        void loadShortVideoFactoryPanel();
        return;
      }
      if (module === "community-packages") {
        void loadCommunityPackagesWorkspace();
        return;
      }
      void loadStorageRetrievalWorkspace();
    },
    [],
  );

  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add("light-mode");
    } else {
      document.documentElement.classList.remove("light-mode");
    }
  }, [isLightMode]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsLightMode(event.matches);
    };

    handleChange(media);

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  const toggleTheme = () => setIsLightMode(!isLightMode);

  useEffect(() => {
    let cancelled = false;

    fetchControlPlaneState()
      .then((state) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setControlPlaneState(state);
          setTargetDirectory((current) =>
            current || state.assetRoot.legacyWorkspaceRoots[0] || state.assetRoot.path,
          );
        });
      })
      .catch((error) => {
        console.error("Failed to load control-plane state", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // SSE Listener for OpenClaw Backend Updates
  useEffect(() => {
    const unsubscribe = subscribeToStream((data) => {
      if (typeof data !== "object" || data === null) {
        return;
      }

      const streamData = data as {
        type?: string;
        payload?: HeartbeatPayload | KnowledgeItem | AgentTask;
        nodeId?: string;
        status?: "idle" | "running" | "error";
        drawerContent?: unknown;
        resultSummary?: string;
      };

      if (streamData.type === "heartbeat" && streamData.payload) {
        const nextHeartbeat = streamData.payload as HeartbeatPayload;
        setHeartbeat(nextHeartbeat);
        if (nextHeartbeat.decisionQueue) {
          startTransition(() => {
            setControlPlaneState((current) =>
              current
                ? { ...current, decisionQueue: nextHeartbeat.decisionQueue ?? current.decisionQueue }
                : current,
            );
          });
        }
        return;
      }

      if (streamData.type === "task-updated" && streamData.payload) {
        const task = streamData.payload as unknown as AgentTask;
        if (task.status === "completed" || task.status === "failed") {
          const toastId = `${task.id}-${task.status}`;
          setToasts((prev) => [
            ...prev,
            {
              id: toastId,
              message:
                task.resultSummary ||
                `${task.nodeLabel} ${task.status === "completed" ? "completed" : "failed"}.`,
            },
          ]);
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== toastId));
          }, 4200);
        }
        return;
      }
    });

    return unsubscribe;
  }, []);

  // Knowledge Stream Listener
  useEffect(() => {
    const unsubscribe = subscribeToKnowledgeStream((data) => {
      if (data.type === "upsert") {
        const item = data.payload as KnowledgeItem;
        const toastId = Date.now().toString();
        setToasts((prev) => [
          ...prev,
          {
            id: toastId,
            message: `OpenClaw learned a new strategy: ${item.human.title}`,
          },
        ]);

        // Remove toast after 3 seconds
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toastId));
        }, 3000);
      }
    });
    return unsubscribe;
  }, []);

  const handleLanguageToggle = useCallback(() => {
    setLanguage(language === "zh" ? "en" : "zh");
  }, [language, setLanguage]);

  const handlePreloadSkillTree = useCallback(() => {
    void loadSkillTreeView();
  }, []);

  const focusDecisionTarget = useCallback(
    (target: "tasks" | "asset-intake" | "evidence-search" | "workspace" | "short-video-factory") => {
      setCurrentView("dashboard");
      setDecisionFocusTarget(target);
      if (target === "asset-intake") {
        preloadWorkspaceModule("storage-retrieval");
        setStorageRetrievalTab("import");
        setActiveControlModule("storage-retrieval");
      } else if (target === "evidence-search") {
        preloadWorkspaceModule("storage-retrieval");
        setStorageRetrievalTab("search");
        setActiveControlModule("storage-retrieval");
      } else if (target === "short-video-factory") {
        preloadWorkspaceModule(target);
        setActiveControlModule(target);
      } else if (target === "workspace") {
        preloadWorkspaceModule("task-history");
        setActiveControlModule("task-history");
      }
      requestAnimationFrame(() => {
        const id =
          target === "asset-intake"
            ? assetPanelId
            : target === "evidence-search"
              ? evidencePanelId
              : target === "short-video-factory"
                ? shortVideoPanelId
                : workspacePanelId;
        const element = document.getElementById(id);
        if (!element) {
          return;
        }
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        if (element instanceof HTMLElement) {
          element.focus({ preventScroll: true });
        }
      });
    },
    [preloadWorkspaceModule],
  );

  const parseShortVideoLinks = useCallback(() => {
    return shortVideoSampleBatchForm.linksText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(",");
        if (parts.length >= 2 && /^douyin|xiaohongshu|xhs$/i.test(parts[0].trim())) {
          const platform = parts[0].trim().toLowerCase() === "xhs" ? "xiaohongshu" : parts[0].trim().toLowerCase();
          return {
            platform,
            url: parts[1].trim(),
            note: parts.slice(2).join(",").trim(),
          };
        }
        return {
          platform: shortVideoSampleBatchForm.platform === "mixed" ? undefined : shortVideoSampleBatchForm.platform,
          url: line,
          note: "",
        };
      });
  }, [shortVideoSampleBatchForm.linksText, shortVideoSampleBatchForm.platform]);

  const pushToast = useCallback((message: string) => {
    const toastId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id: toastId, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== toastId));
    }, 4200);
  }, []);

  const refreshControlPlane = useCallback(async () => {
    try {
      const state = await fetchControlPlaneState();
      startTransition(() => {
        setControlPlaneState(state);
        setTargetDirectory((current) =>
          current || state.assetRoot.legacyWorkspaceRoots[0] || state.assetRoot.path,
        );
      });
    } catch (error) {
      console.error("Failed to refresh control-plane state", error);
    }
  }, []);

  const handleOpenPath = useCallback(
    async (targetPath: string, options?: { reveal?: boolean }) => {
      try {
        if (
          !options?.reveal &&
          (targetPath.endsWith(".md") ||
            targetPath.endsWith(".json") ||
            targetPath.endsWith(".txt") ||
            targetPath.endsWith(".csv") ||
            targetPath.endsWith(".xlsx") ||
            targetPath.endsWith(".docx"))
        ) {
          window.open(`/api/v1/artifact/human?path=${encodeURIComponent(targetPath)}`, "_blank", "noopener,noreferrer");
          pushToast(t("toast.path.opened"));
          return;
        }

        await openLocalPath(targetPath, options);
        pushToast(
          options?.reveal
            ? t("toast.path.revealed")
            : t("toast.path.opened"),
        );
      } catch (error) {
        console.error(error);
        pushToast(
          error instanceof Error ? error.message : t("toast.path.failed"),
        );
      }
    },
    [pushToast, t],
  );

  const handleOpenKnowledgeLink = useCallback((link: string) => {
    window.open(link, "_blank", "noopener,noreferrer");
  }, []);

  const handleAdoptSuggestedRoot = useCallback(async () => {
    const suggested = controlPlaneState?.assetRoot.suggestedPath;
    if (!suggested) {
      return;
    }

    try {
      const response = await updateAssetRoot(suggested);
      setControlPlaneState((current) =>
        current ? { ...current, assetRoot: response.assetRoot } : current,
      );
      setTargetDirectory((current) => current || response.assetRoot.path);
      setIntakeLastActionMessage(`Saved asset root: ${response.assetRoot.path}`);
      setIntakeErrorMessage(undefined);
      pushToast(`Asset root saved: ${response.assetRoot.path}`);
      await refreshControlPlane();
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Failed to save asset root";
      setIntakeErrorMessage(message);
      pushToast(message);
    }
  }, [controlPlaneState?.assetRoot.suggestedPath, pushToast, refreshControlPlane]);

  const handleQueueAssetIntake = useCallback(
    async (action: "organize" | "index" | "fullIntake") => {
      try {
        setIntakeLoadingAction(action);
        setIntakeErrorMessage(undefined);
        const response = await queueAssetIntake({
          targetDir: targetDirectory,
          archiveRule: archiveRuleNote,
          action: action === "fullIntake" ? "full" : action,
        });
        setIntakeLastActionMessage(response.decisionSummary);
        const highlighted = response.queuedTasks[0]?.id;
        if (highlighted) {
          setHighlightedTaskId(highlighted);
        }
        pushToast(
          action === "fullIntake"
            ? `Queued archive + index for ${targetDirectory}`
            : `Queued ${action} for ${targetDirectory}`,
        );
        await refreshControlPlane();
      } catch (error) {
        console.error(error);
        const message =
          error instanceof Error ? error.message : "Failed to queue asset intake";
        setIntakeErrorMessage(message);
        pushToast(message);
      } finally {
        setIntakeLoadingAction(null);
      }
    },
    [archiveRuleNote, pushToast, refreshControlPlane, targetDirectory],
  );

  const handleQueueAssetIntakeForTarget = useCallback(
    async (action: "organize" | "index" | "fullIntake", explicitTargetDir: string) => {
      try {
        setIntakeLoadingAction(action);
        setIntakeErrorMessage(undefined);
        const response = await queueAssetIntake({
          targetDir: explicitTargetDir,
          archiveRule: archiveRuleNote,
          action: action === "fullIntake" ? "full" : action,
        });
        setTargetDirectory(explicitTargetDir);
        setIntakeLastActionMessage(response.decisionSummary);
        const highlighted = response.queuedTasks[0]?.id;
        if (highlighted) {
          setHighlightedTaskId(highlighted);
        }
        pushToast(
          action === "fullIntake"
            ? `Queued archive + index for ${explicitTargetDir}`
            : `Queued ${action} for ${explicitTargetDir}`,
        );
        await refreshControlPlane();
      } catch (error) {
        console.error(error);
        const message =
          error instanceof Error ? error.message : "Failed to queue asset intake";
        setIntakeErrorMessage(message);
        pushToast(message);
      } finally {
        setIntakeLoadingAction(null);
      }
    },
    [archiveRuleNote, pushToast, refreshControlPlane],
  );

  const handleCreateShortVideoBatch = useCallback(async () => {
    try {
      setShortVideoLoadingAction("batch");
      setShortVideoErrorMessage(undefined);
      const result = await createShortVideoSampleBatch({
        platform: shortVideoSampleBatchForm.platform,
        accountName: shortVideoSampleBatchForm.accountName,
        accountHandle: shortVideoSampleBatchForm.accountHandle,
        objective: shortVideoSampleBatchForm.objective,
        sampleSize: shortVideoSampleBatchForm.sampleSize,
        targetMode: "script-first",
        links: parseShortVideoLinks(),
      });
      setShortVideoSuccessMessage(result.executionSummary);
      pushToast(result.executionSummary);
      await refreshControlPlane();
    } catch (error) {
      console.error(error);
      setShortVideoErrorMessage(error instanceof Error ? error.message : t("shortVideoFactory.error.generic"));
    } finally {
      setShortVideoLoadingAction(null);
    }
  }, [parseShortVideoLinks, pushToast, refreshControlPlane, shortVideoSampleBatchForm, t]);

  const handleQueueShortVideoResearch = useCallback(async () => {
    try {
      const manifestPath = controlPlaneState?.shortVideoFactory.latestSampleBatch?.path;
      if (!manifestPath) {
        throw new Error(t("shortVideoFactory.error.missingBatch"));
      }
      setShortVideoLoadingAction("research");
      setShortVideoErrorMessage(undefined);
      const result = await queueShortVideoAccountResearch({ manifestPath });
      setShortVideoSuccessMessage(result.message);
      pushToast(t("shortVideoFactory.toast.researchQueued"));
      await refreshControlPlane();
    } catch (error) {
      console.error(error);
      setShortVideoErrorMessage(error instanceof Error ? error.message : t("shortVideoFactory.error.generic"));
    } finally {
      setShortVideoLoadingAction(null);
    }
  }, [controlPlaneState?.shortVideoFactory.latestSampleBatch?.path, pushToast, refreshControlPlane, t]);

  const handleQueueShortVideoBrief = useCallback(async () => {
    try {
      const researchBundlePath = controlPlaneState?.shortVideoFactory.latestResearchBundle?.path;
      if (!researchBundlePath) {
        throw new Error(t("shortVideoFactory.error.missingResearch"));
      }
      setShortVideoLoadingAction("brief");
      setShortVideoErrorMessage(undefined);
      const result = await queueShortVideoCreativeBrief({
        researchBundlePath,
        selectedContentIds: shortVideoCreativeForm.selectedContentIds
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        targetPlatform: shortVideoCreativeForm.targetPlatform,
        targetGoal: shortVideoCreativeForm.targetGoal,
        imitationStrategy: shortVideoCreativeForm.imitationStrategy,
        tone: shortVideoCreativeForm.tone,
        durationTarget: shortVideoCreativeForm.durationTarget,
      });
      setShortVideoSuccessMessage(result.message);
      pushToast(t("shortVideoFactory.toast.briefQueued"));
      await refreshControlPlane();
    } catch (error) {
      console.error(error);
      setShortVideoErrorMessage(error instanceof Error ? error.message : t("shortVideoFactory.error.generic"));
    } finally {
      setShortVideoLoadingAction(null);
    }
  }, [controlPlaneState?.shortVideoFactory.latestResearchBundle?.path, pushToast, refreshControlPlane, shortVideoCreativeForm, t]);

  const handleQueueShortVideoProduction = useCallback(async () => {
    try {
      const creativeBriefPath = controlPlaneState?.shortVideoFactory.latestCreativeBrief?.path;
      if (!creativeBriefPath) {
        throw new Error(t("shortVideoFactory.error.missingBrief"));
      }
      setShortVideoLoadingAction("production");
      setShortVideoErrorMessage(undefined);
      const result = await queueShortVideoDirectorProduction({
        creativeBriefPath,
        generateAiClips: shortVideoCreativeForm.generateAiClips,
      });
      setShortVideoSuccessMessage(result.message);
      pushToast(t("shortVideoFactory.toast.productionQueued"));
      await refreshControlPlane();
    } catch (error) {
      console.error(error);
      setShortVideoErrorMessage(error instanceof Error ? error.message : t("shortVideoFactory.error.generic"));
    } finally {
      setShortVideoLoadingAction(null);
    }
  }, [controlPlaneState?.shortVideoFactory.latestCreativeBrief?.path, pushToast, refreshControlPlane, shortVideoCreativeForm.generateAiClips, t]);

  const handleQueueNotebooklmEnhance = useCallback(async () => {
    try {
      const researchBundlePath = controlPlaneState?.shortVideoFactory.latestResearchBundle?.path;
      const creativeBriefPath = controlPlaneState?.shortVideoFactory.latestCreativeBrief?.path;
      if (!researchBundlePath) {
        throw new Error(t("shortVideoFactory.error.missingResearch"));
      }
      if (!creativeBriefPath) {
        throw new Error(t("shortVideoFactory.error.missingBrief"));
      }
      setShortVideoLoadingAction("notebooklm");
      setShortVideoErrorMessage(undefined);
      const result = await queueNotebooklmAccountEnhance({
        researchBundlePath,
        creativeBriefPath,
      });
      setShortVideoSuccessMessage(result.message);
      pushToast(t("shortVideoFactory.toast.notebooklmQueued"));
      await refreshControlPlane();
    } catch (error) {
      console.error(error);
      setShortVideoErrorMessage(error instanceof Error ? error.message : t("shortVideoFactory.error.generic"));
    } finally {
      setShortVideoLoadingAction(null);
    }
  }, [
    controlPlaneState?.shortVideoFactory.latestCreativeBrief?.path,
    controlPlaneState?.shortVideoFactory.latestResearchBundle?.path,
    pushToast,
    refreshControlPlane,
    t,
  ]);

  const handleCaptureSavedVideoInsight = useCallback(async () => {
    try {
      setShortVideoLoadingAction("insight");
      setShortVideoErrorMessage(undefined);
      const result = await queueSavedVideoInsightCapture({
        videoUrl: shortVideoInsightForm.videoUrl,
        objective: shortVideoInsightForm.objective,
        reflectionNote: shortVideoInsightForm.reflectionNote,
        collectionName: shortVideoInsightForm.collectionName,
      });
      setShortVideoSuccessMessage(result.message);
      pushToast(t("shortVideoFactory.toast.insightQueued"));
      await refreshControlPlane();
    } catch (error) {
      console.error(error);
      setShortVideoErrorMessage(error instanceof Error ? error.message : t("shortVideoFactory.error.generic"));
    } finally {
      setShortVideoLoadingAction(null);
    }
  }, [pushToast, refreshControlPlane, shortVideoInsightForm, t]);

  const runEvidenceSearch = useCallback(
    async (queryOverride?: string) => {
      const nextQuery = (queryOverride ?? evidenceQuery).trim();
      if (!nextQuery) {
        setEvidenceResults([]);
        return;
      }

      try {
        setEvidenceLoading(true);
        const { results } = await searchKnowledge(nextQuery);
        startTransition(() => {
          setEvidenceResults(results);
        });
      } catch (error) {
        console.error(error);
        pushToast(
          error instanceof Error ? error.message : "Failed to search evidence",
        );
      } finally {
        setEvidenceLoading(false);
      }
    },
    [evidenceQuery, pushToast],
  );

  const handleEvidenceSearch = useCallback(async () => {
    if (!evidenceQuery.trim()) {
      setEvidenceResults([]);
      return;
    }

    await runEvidenceSearch();
  }, [evidenceQuery, runEvidenceSearch]);

  const handleOpenFeedback = useCallback((task: AgentTask) => {
    setFeedbackTask(task);
    setFeedbackResult(null);
  }, []);

  const handleViewEvolutionTask = useCallback((taskId: string) => {
    setCurrentView("dashboard");
    setHighlightedTaskId(taskId);
    focusDecisionTarget("workspace");
    setTimeout(() => {
      setHighlightedTaskId((current) => (current === taskId ? null : current));
    }, 7000);
  }, [focusDecisionTarget]);

  const handleDecisionAction = useCallback(
    async (
      decisionId: string,
      action: "ignore" | "snooze" | "resolve" | "retry-task",
      options?: { relatedTaskId?: string; successMessage?: string },
    ) => {
      try {
        setDecisionActionId(decisionId);
        await applyDecisionAction({
          decisionId,
          action,
          relatedTaskId: options?.relatedTaskId,
        });
        if (options?.successMessage) {
          pushToast(options.successMessage);
        }
        await refreshControlPlane();
      } catch (error) {
        console.error(error);
        pushToast(error instanceof Error ? error.message : t("decisionQueue.toast.actionFailed"));
      } finally {
        setDecisionActionId((current) => (current === decisionId ? null : current));
      }
    },
    [pushToast, refreshControlPlane, t],
  );

  const handleSubmitFeedback = useCallback(
    async ({
      sentiment,
      feedback,
    }: {
      sentiment: "positive" | "negative" | "idea";
      feedback: string;
    }) => {
      if (!feedbackTask || !feedback.trim()) {
        return;
      }

      try {
        setIsSubmittingFeedback(true);
        const result = await submitTaskFeedback(feedbackTask.id, feedback, {
          sentiment,
          artifacts: extractTaskArtifacts(feedbackTask).map((item) => item.path),
        });
        setFeedbackResult(result);
        if (result.evolutionTaskId) {
          setHighlightedTaskId(result.evolutionTaskId);
        }
        pushToast(t("toast.feedback.saved"));
        await refreshControlPlane();
      } catch (error) {
        console.error(error);
        pushToast(
          error instanceof Error ? error.message : t("toast.feedback.failed"),
        );
      } finally {
        setIsSubmittingFeedback(false);
      }
    },
    [feedbackTask, pushToast, refreshControlPlane, t],
  );

  const decisionQueueItems = (
    heartbeat?.decisionQueue ?? controlPlaneState?.decisionQueue ?? []
  ).map((item) => {
    const firstPathRef = item.refs?.find((ref) => Boolean(ref.path));
    const isAssetDecision =
      item.relatedNodeId === "project_file_organize" ||
      item.relatedNodeId === "project_file_index" ||
      item.title === "Asset Root Needed";
    const isEvidenceDecision = item.title === "Evidence Needs Refresh";
    const isFailureDecision = item.title === "Failure Cluster";
    const isShortVideoDecision =
      item.relatedNodeId === "short_video_account_research" ||
      item.relatedNodeId === "short_video_creative_brief" ||
      item.relatedNodeId === "short_video_director_production" ||
      item.relatedNodeId === "notebooklm_account_enhance" ||
      item.relatedNodeId === "short_video_factory";

    const next: {
      ctaLabel?: string;
      onActionClick?: () => void;
      secondaryCtaLabel?: string;
      onSecondaryActionClick?: () => void;
      ignoreLabel?: string;
      onIgnoreClick?: () => void;
      snoozeLabel?: string;
      onSnoozeClick?: () => void;
    } = {};

    if (item.title === "Asset Root Needed" && !controlPlaneState?.assetRoot.configured) {
      next.ctaLabel = t("decisionQueue.action.adoptRoot");
      next.onActionClick = async () => {
        await handleAdoptSuggestedRoot();
        await handleDecisionAction(item.id, "resolve", {
          successMessage: t("decisionQueue.toast.resolved"),
        });
      };
      next.secondaryCtaLabel = t("decisionQueue.action.openAssetIntake");
      next.onSecondaryActionClick = () => focusDecisionTarget("asset-intake");
    } else if (isAssetDecision) {
      next.ctaLabel =
        item.relatedNodeId === "project_file_index"
          ? t("decisionQueue.action.runIndex")
          : t("decisionQueue.action.runArchive");
      next.onActionClick = async () => {
        const explicitTargetDir = firstPathRef?.path || targetDirectory;
        await handleQueueAssetIntakeForTarget(
          item.relatedNodeId === "project_file_index" ? "index" : "organize",
          explicitTargetDir,
        );
        await handleDecisionAction(item.id, "resolve", {
          successMessage: t("decisionQueue.toast.resolved"),
        });
      };
      if (item.relatedTaskId) {
        next.secondaryCtaLabel = t("decisionQueue.action.highlightTask");
        next.onSecondaryActionClick = () => handleViewEvolutionTask(item.relatedTaskId as string);
      }
    } else if (isEvidenceDecision) {
      next.ctaLabel = t("decisionQueue.action.retryTask");
      next.onActionClick = () =>
        handleDecisionAction(item.id, "retry-task", {
          relatedTaskId: item.relatedTaskId,
          successMessage: t("decisionQueue.toast.retryQueued"),
        });
      next.secondaryCtaLabel = t("decisionQueue.action.searchEvidence");
      next.onSecondaryActionClick = async () => {
        const nextQuery = item.relatedNodeId || firstPathRef?.value || item.title;
        if (item.relatedTaskId) {
          setHighlightedTaskId(item.relatedTaskId);
          setTimeout(() => {
            setHighlightedTaskId((current) => (current === item.relatedTaskId ? null : current));
          }, 7000);
        }
        setEvidenceQuery(nextQuery);
        focusDecisionTarget("evidence-search");
        await runEvidenceSearch(nextQuery);
      };
    } else if (isFailureDecision && item.relatedTaskId) {
      next.ctaLabel = t("decisionQueue.action.retryTask");
      next.onActionClick = () =>
        handleDecisionAction(item.id, "retry-task", {
          relatedTaskId: item.relatedTaskId,
          successMessage: t("decisionQueue.toast.retryQueued"),
        });
      next.secondaryCtaLabel = t("decisionQueue.action.openWorkspace");
      next.onSecondaryActionClick = () => focusDecisionTarget("workspace");
    } else if (isShortVideoDecision) {
      if (item.relatedNodeId === "short_video_account_research") {
        next.ctaLabel = t("shortVideoFactory.action.runResearch");
        next.onActionClick = async () => {
          await handleQueueShortVideoResearch();
          await handleDecisionAction(item.id, "resolve", {
            successMessage: t("decisionQueue.toast.resolved"),
          });
        };
      } else if (item.relatedNodeId === "short_video_creative_brief") {
        next.ctaLabel = t("shortVideoFactory.action.generateBrief");
        next.onActionClick = async () => {
          await handleQueueShortVideoBrief();
          await handleDecisionAction(item.id, "resolve", {
            successMessage: t("decisionQueue.toast.resolved"),
          });
        };
      } else if (item.relatedNodeId === "notebooklm_account_enhance") {
        next.ctaLabel = t("shortVideoFactory.action.runNotebooklm");
        next.onActionClick = async () => {
          await handleQueueNotebooklmEnhance();
          await handleDecisionAction(item.id, "resolve", {
            successMessage: t("decisionQueue.toast.resolved"),
          });
        };
      } else if (item.relatedNodeId === "short_video_director_production") {
        next.ctaLabel = t("shortVideoFactory.action.runProduction");
        next.onActionClick = async () => {
          await handleQueueShortVideoProduction();
          await handleDecisionAction(item.id, "resolve", {
            successMessage: t("decisionQueue.toast.resolved"),
          });
        };
      } else {
        next.ctaLabel = t("decisionQueue.action.openShortVideoFactory");
        next.onActionClick = () => focusDecisionTarget("short-video-factory");
      }
      if (firstPathRef?.path) {
        next.secondaryCtaLabel = t("shortVideoFactory.action.openArtifact");
        next.onSecondaryActionClick = () => handleOpenPath(firstPathRef.path as string);
      }
    } else if (item.relatedTaskId) {
      next.ctaLabel = t("decisionQueue.action.retryTask");
      next.onActionClick = () =>
        handleDecisionAction(item.id, "retry-task", {
          relatedTaskId: item.relatedTaskId,
          successMessage: t("decisionQueue.toast.retryQueued"),
        });
      next.secondaryCtaLabel = t("decisionQueue.action.highlightTask");
      next.onSecondaryActionClick = () => handleViewEvolutionTask(item.relatedTaskId as string);
    } else {
      next.ctaLabel = t("decisionQueue.action.markResolved");
      next.onActionClick = () =>
        handleDecisionAction(item.id, "resolve", {
          successMessage: t("decisionQueue.toast.resolved"),
        });
    }

    next.ignoreLabel = decisionActionId === item.id ? t("decisionQueue.action.working") : t("decisionQueue.action.ignore");
    next.onIgnoreClick = () =>
      handleDecisionAction(item.id, "ignore", {
        successMessage: t("decisionQueue.toast.ignored"),
      });
    next.snoozeLabel = decisionActionId === item.id ? t("decisionQueue.action.working") : t("decisionQueue.action.snooze");
    next.onSnoozeClick = () =>
      handleDecisionAction(item.id, "snooze", {
        successMessage: t("decisionQueue.toast.snoozed"),
      });

    return {
      id: item.id,
      priority: decisionPriorityNumber(item.priority),
      title: item.title,
      reason: item.reason,
      nextAction: item.nextAction,
      statusLabels: [item.status],
      evidenceLabels: item.evidenceLevel ? [item.evidenceLevel] : [],
      refs:
        item.refs?.map((ref) => ({
          label: ref.label,
          value: ref.value,
        })) ?? [],
      ...next,
    };
  });

  const evidencePanelResults = evidenceResults.map(mapKnowledgeToEvidenceResult);
  const controlModules = [
    {
      id: "task-history" as const,
      label: t("dashboard.module.history.title"),
      summary:
        heartbeat?.recentTasks?.[0]?.nodeLabel ??
        t("dashboard.module.history.ready"),
      icon: Activity,
    },
    {
      id: "short-video-factory" as const,
      label: t("dashboard.module.video.title"),
      summary:
        controlPlaneState?.shortVideoFactory.latestProductionPack?.label ??
        t("dashboard.module.video.ready"),
      icon: Clapperboard,
    },
    {
      id: "storage-retrieval" as const,
      label: t("dashboard.module.storage.title"),
      summary: evidenceQuery.trim()
        ? t("dashboard.module.storage.searchActive")
        : controlPlaneState?.assetRoot.configured
          ? t("dashboard.module.storage.ready")
          : t("dashboard.module.storage.pending"),
      icon: FolderSearch,
    },
    {
      id: "community-packages" as const,
      label: t("dashboard.module.packages.title"),
      summary: t("dashboard.module.packages.ready"),
      icon: BookOpenText,
    },
  ];
  const workspaceFallback = (
    <div
      className="rounded-[1.35rem] border px-5 py-10 text-sm text-center"
      style={{
        background: "var(--panel-surface)",
        borderColor: "var(--border-color)",
        color: "var(--text-secondary)",
        boxShadow: "var(--panel-shadow)",
      }}
    >
      {t("dashboard.workspace.loading")}
    </div>
  );

  return (
    <div
      className="w-full h-screen bg-transparent overflow-hidden relative font-sans transition-colors duration-300 flex"
      style={{ color: "var(--text-primary)" }}
    >
      <a
        href="#app-main"
        className="absolute left-4 top-4 z-[100] rounded-full px-4 py-2 text-xs font-medium translate-y-[-200%] focus:translate-y-0 transition-transform"
        style={{
          backgroundColor: "var(--bg-secondary)",
          color: "var(--text-primary)",
          border: "1px solid var(--border-color)",
        }}
      >
        {t("skip.main")}
      </a>
      {/* Header */}
      <header
        className="absolute top-0 left-0 right-0 h-14 border-b z-10 flex items-center px-6 justify-between transition-colors duration-300"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border-color)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-1.5 rounded-md border"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderColor: "var(--border-color)",
            }}
          >
            <Terminal
              className="w-4 h-4"
              style={{ color: "var(--text-primary)" }}
            />
          </div>
          <h1 className="text-sm font-semibold tracking-tight">
            OpenClaw{" "}
            <span
              className="font-mono text-xs ml-2"
              style={{ color: "var(--text-secondary)" }}
            >
              v1.0.0
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-6 text-xs font-medium">
          <span
            className="flex items-center gap-2"
            style={{ color: "var(--text-secondary)" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: heartbeat?.agent.online
                  ? "var(--node-run-text)"
                  : "var(--node-err-text)",
              }}
            />
            {heartbeat?.agent.online
              ? t("header.status.linked")
              : t("header.status.waiting")}
          </span>
          <button
            onClick={handleLanguageToggle}
            className="px-2.5 py-1.5 rounded-md transition-colors border text-[11px] font-semibold"
            style={{
              color: "var(--text-primary)",
              borderColor: "var(--border-color)",
            }}
            aria-label={t("header.lang.toggle")}
            title={t("header.lang.toggle")}
          >
            {language === "zh" ? "EN" : "中文"}
          </button>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5 border"
            style={{
              color: "var(--text-secondary)",
              borderColor: "var(--border-color)",
            }}
            aria-label={t("header.theme.toggle")}
            title={t("header.theme.toggle")}
          >
            {isLightMode ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="app-main" className="w-full h-full pt-14 relative">
        <AnimatePresence mode="wait">
          {currentView === "dashboard" ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="w-full h-full flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden"
            >
              <div
                className="w-full lg:w-[32%] shrink-0 border-b lg:border-b-0 lg:border-r px-3 md:px-6 py-3 md:py-6 space-y-4 lg:overflow-y-auto"
                style={{
                  borderColor: "var(--border-color)",
                  background: "linear-gradient(180deg, var(--bg-secondary), var(--bg-primary))",
                }}
              >
                <ConsoleStatusCard
                  heartbeat={heartbeat}
                  onOpenTree={() => setCurrentView("skillTree")}
                  onOpenGuide={() => setIsGuideOpen(true)}
                  onPreloadTree={handlePreloadSkillTree}
                />
                <div id={workspacePanelId} tabIndex={-1}>
                  <DecisionQueuePanel
                    decisions={decisionQueueItems}
                    liveSummary={{
                      agentOnline: Boolean(heartbeat?.agent.online),
                      activeCount: heartbeat?.activeTasks.length ?? 0,
                      queuedCount: heartbeat?.queuedTasks.length ?? 0,
                      latestResultLabel: heartbeat?.recentTasks?.[0]?.nodeLabel,
                    }}
                  />
                </div>
              </div>

              <div
                className="w-full lg:w-[68%] h-auto lg:h-full p-3 md:p-6 flex flex-col gap-4 overflow-visible lg:overflow-y-auto"
                style={{ backgroundColor: "var(--bg-primary)" }}
              >
                <div className="max-w-4xl w-full mx-auto space-y-4">
                  <section
                    className="rounded-[18px] border p-4 space-y-3"
                    style={{
                      background: "var(--panel-surface)",
                      borderColor: "var(--border-color)",
                      boxShadow: "var(--panel-shadow)",
                    }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {t("dashboard.module.title")}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        {t("dashboard.module.subtitle")}
                      </p>
                    </div>
                    <div className="grid gap-2 md:grid-cols-3">
                      {controlModules.map((module) => {
                        const Icon = module.icon;
                        const isActive = activeControlModule === module.id;
                        return (
                          <button
                            key={module.id}
                            type="button"
                            onClick={() => setActiveControlModule(module.id)}
                            onMouseEnter={() => preloadWorkspaceModule(module.id)}
                            onFocus={() => preloadWorkspaceModule(module.id)}
                            data-testid={`workspace-tab-${module.id}`}
                            className="rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5"
                            style={{
                              borderColor: isActive ? "var(--node-run-border)" : "var(--border-color)",
                              backgroundColor: isActive ? "rgba(59, 130, 246, 0.08)" : "var(--bg-secondary)",
                            }}
                            aria-pressed={isActive}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" style={{ color: isActive ? "var(--node-run-border)" : "var(--text-secondary)" }} />
                              <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                                {module.label}
                              </span>
                            </div>
                            <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                              {module.summary}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                  {activeControlModule === "task-history" ? (
                    <Suspense fallback={workspaceFallback}>
                      <div id={workspacePanelId} tabIndex={-1}>
                        <TaskHistoryWorkspace
                          heartbeat={heartbeat}
                          onOpenPath={handleOpenPath}
                          onFeedback={handleOpenFeedback}
                        />
                      </div>
                    </Suspense>
                  ) : null}
                  {controlPlaneState && (
                    activeControlModule === "short-video-factory" ? (
                    <Suspense fallback={workspaceFallback}>
                      <div id={shortVideoPanelId} tabIndex={-1}>
                        <ShortVideoFactoryPanel
                          factoryState={controlPlaneState.shortVideoFactory}
                          sampleBatchForm={shortVideoSampleBatchForm}
                          creativeForm={shortVideoCreativeForm}
                          insightForm={shortVideoInsightForm}
                          loadingAction={shortVideoLoadingAction}
                          errorMessage={shortVideoErrorMessage}
                          successMessage={shortVideoSuccessMessage}
                          onSampleBatchFormChange={(patch) =>
                            setShortVideoSampleBatchForm((current) => ({ ...current, ...patch }))
                          }
                          onCreativeFormChange={(patch) =>
                            setShortVideoCreativeForm((current) => ({ ...current, ...patch }))
                          }
                          onInsightFormChange={(patch) =>
                            setShortVideoInsightForm((current) => ({ ...current, ...patch }))
                          }
                          onCreateBatch={handleCreateShortVideoBatch}
                          onRunResearch={handleQueueShortVideoResearch}
                        onGenerateBrief={handleQueueShortVideoBrief}
                        onRunNotebooklmEnhance={handleQueueNotebooklmEnhance}
                        onRunProduction={handleQueueShortVideoProduction}
                          onCaptureInsight={handleCaptureSavedVideoInsight}
                          onOpenPath={handleOpenPath}
                        />
                      </div>
                    </Suspense>
                    ) : null
                  )}
                  {controlPlaneState && activeControlModule === "storage-retrieval" ? (
                  <Suspense fallback={workspaceFallback}>
                    <div id={assetPanelId} tabIndex={-1} className="min-h-[24rem]">
                      <StorageRetrievalWorkspace
                        assetRoot={controlPlaneState.assetRoot}
                        initialTab={storageRetrievalTab}
                        recentTasks={heartbeat?.recentTasks ?? []}
                        targetDirectory={targetDirectory}
                        archiveRuleNote={archiveRuleNote}
                        onTargetDirectoryChange={setTargetDirectory}
                        onArchiveRuleNoteChange={setArchiveRuleNote}
                        onQueueOrganize={() => handleQueueAssetIntake("organize")}
                        onQueueIndex={() => handleQueueAssetIntake("index")}
                        onQueueFullIntake={() => handleQueueAssetIntake("fullIntake")}
                        onOpenPath={handleOpenPath}
                      />
                    </div>
                  </Suspense>
                  ) : null}
                  {activeControlModule === "community-packages" ? (
                  <Suspense fallback={workspaceFallback}>
                    <div className="min-h-[24rem]">
                      <CommunityPackagesWorkspace
                        onOpenPath={handleOpenPath}
                      />
                    </div>
                  </Suspense>
                  ) : null}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="skillTree"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="w-full h-full"
            >
              <Suspense
                fallback={
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ backgroundColor: "var(--bg-primary)" }}
                  >
                    <div
                      className="rounded-2xl border px-6 py-4 text-sm font-medium"
                      style={{
                        backgroundColor: "var(--bg-secondary)",
                        borderColor: "var(--border-color)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {t("skillTree.loading")}
                    </div>
                  </div>
                }
              >
                <SkillTreeView onBack={() => setCurrentView("dashboard")} />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <QuickGuideModal open={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      <TaskFeedbackModal
        open={Boolean(feedbackTask)}
        task={feedbackTask}
        artifacts={feedbackTask ? extractTaskArtifacts(feedbackTask) : []}
        submitting={isSubmittingFeedback}
        result={feedbackResult}
        onClose={() => {
          setFeedbackTask(null);
          setFeedbackResult(null);
        }}
        onSubmit={handleSubmitFeedback}
        onOpenPath={handleOpenPath}
        onViewEvolutionTask={handleViewEvolutionTask}
      />
      {/* Toasts */}
      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="px-4 py-3 rounded-lg border shadow-lg backdrop-blur-md max-w-sm"
              style={{
                backgroundColor: "var(--bg-secondary)",
                borderColor: "var(--border-color)",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0 animate-pulse"
                  style={{ backgroundColor: "var(--node-run-text)" }}
                />
                <p
                  className="text-xs font-medium leading-relaxed"
                  style={{ color: "var(--text-primary)" }}
                >
                  {toast.message}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default function App() {
  return <Flow />;
}
