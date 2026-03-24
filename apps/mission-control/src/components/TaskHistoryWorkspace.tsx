import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, FileText, FolderOpen, FolderSearch, MessageSquarePlus, Sparkles } from "lucide-react";
import { AgentTask, TaskHistoryGroup } from "../types";
import { fetchTaskHistory } from "../services/api";
import { extractTaskArtifacts } from "../utils/taskArtifacts";
import { useI18n } from "../i18n";

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

const TaskRow = ({
  task,
  tone,
  onOpenPath,
  onFeedback,
}: {
  task: AgentTask;
  tone: "recent";
  onOpenPath: (path: string, options?: { reveal?: boolean }) => void;
  onFeedback: (task: AgentTask) => void;
}) => {
  const { t } = useI18n();
  const artifacts = extractTaskArtifacts(task);
  const primaryArtifact = artifacts.find((item) => item.primary) ?? artifacts[0];
  const knowledgeNote = artifacts.find((item) => item.key === "knowledge_note");

  return (
    <div
      className="px-3 py-3 rounded-lg border gap-3"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border-color)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <span
            className="w-1.5 h-1.5 rounded-full mt-1.5"
            style={{ backgroundColor: task.status === "failed" ? "var(--node-err-text)" : "var(--text-secondary)" }}
          />
          <div className="min-w-0">
            <div className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {task.nodeLabel}
            </div>
            <div className="text-[10px] truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {task.command}
            </div>
            {task.resultSummary ? (
              <div className="text-[10px] mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {task.resultSummary}
              </div>
            ) : null}
          </div>
        </div>
        <span className="text-[10px] font-mono shrink-0" style={{ color: "var(--text-secondary)" }}>
          {tone === "recent" ? formatTaskTime(task.updatedAt, t) : t("task.status.queued")}
        </span>
      </div>

      {(primaryArtifact || knowledgeNote) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {primaryArtifact ? (
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
          ) : null}

          {knowledgeNote ? (
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
          ) : null}

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
        </div>
      )}
    </div>
  );
};

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
          <div className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {group.familyLabel}
          </div>
          <div className="mt-1 text-[10px]" style={{ color: "var(--text-secondary)" }}>
            {t("task.history.summary", {
              total: group.totalRuns,
              completed: group.completedRuns,
              failed: group.failedRuns,
            })}
          </div>
          {latestTask?.resultSummary ? (
            <div className="mt-1 text-[10px] line-clamp-2" style={{ color: "var(--text-secondary)" }}>
              {latestTask.resultSummary}
            </div>
          ) : null}
        </div>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          style={{ color: "var(--text-secondary)" }}
        />
      </button>

      {expanded ? (
        <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: "var(--border-color)" }}>
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
      ) : null}
    </div>
  );
};

export const TaskHistoryWorkspace = React.memo(function TaskHistoryWorkspace({
  heartbeat,
  onOpenPath,
  onFeedback,
}: {
  heartbeat: {
    recentTasks?: AgentTask[];
  } | null;
  onOpenPath: (path: string, options?: { reveal?: boolean }) => void;
  onFeedback: (task: AgentTask) => void;
}) {
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
      className="rounded-[1.35rem] border p-4 space-y-5"
      style={{
        background: "var(--panel-surface)",
        borderColor: "var(--border-color)",
        boxShadow: "var(--panel-shadow)",
      }}
    >
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]"
          style={{
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--border-color)",
            color: "var(--text-secondary)",
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {t("dashboard.workspace.title")}
        </div>
        <h2 className="mt-3 text-[1.35rem] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          {t("dashboard.workspace.heading")}
        </h2>
      </div>

      <div
        className="rounded-[1.2rem] border px-4 py-4 space-y-3"
        style={{
          background: "var(--panel-surface-soft)",
          borderColor: "var(--border-color)",
        }}
      >
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-secondary)" }}>
          {t("dashboard.workspace.latest")}
        </div>

        {recentTask ? (
          <>
            <div className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              {recentTask.nodeLabel}
            </div>
            <div className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {recentTask.resultSummary || recentTask.command}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {primaryArtifact ? (
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
              ) : null}
              {noteArtifact ? (
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
              ) : null}
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
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {t("dashboard.workspace.empty")}
          </div>
        )}
      </div>

      <div
        className="rounded-[1.2rem] border px-4 py-4 space-y-3"
        style={{
          background: "var(--panel-surface-soft)",
          borderColor: "var(--border-color)",
        }}
      >
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-secondary)" }}>
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
        {historyHasMore ? (
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
            {historyLoading ? t("dashboard.workspace.historyLoading") : t("dashboard.workspace.historyMore")}
          </button>
        ) : null}
      </div>
    </div>
  );
});
