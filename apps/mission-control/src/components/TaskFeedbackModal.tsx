import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, MessageSquareText, Sparkles, ThumbsUp, AlertTriangle, Lightbulb, Activity } from "lucide-react";
import { AgentTask, TaskArtifact, TaskFeedbackResult } from "../types";
import { useI18n } from "../i18n";

type FeedbackIntent = "positive" | "negative" | "idea";

export function TaskFeedbackModal({
  open,
  task,
  artifacts,
  submitting,
  result,
  onClose,
  onSubmit,
  onOpenPath,
  onViewEvolutionTask,
}: {
  open: boolean;
  task: AgentTask | null;
  artifacts: TaskArtifact[];
  submitting: boolean;
  result: TaskFeedbackResult | null;
  onClose: () => void;
  onSubmit: (payload: { sentiment: FeedbackIntent; feedback: string }) => void;
  onOpenPath: (path: string, options?: { reveal?: boolean }) => void;
  onViewEvolutionTask: (taskId: string) => void;
}) {
  const { t } = useI18n();
  const [sentiment, setSentiment] = useState<FeedbackIntent>("negative");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!open) {
      setFeedback("");
      setSentiment("negative");
    }
  }, [open, task?.id]);

  if (!open || !task) {
    return null;
  }

  const actions: Array<{
    value: FeedbackIntent;
    icon: React.ReactNode;
    label: string;
  }> = [
    {
      value: "negative",
      icon: <AlertTriangle className="w-4 h-4" />,
      label: t("task.feedback.intent.issue"),
    },
    {
      value: "idea",
      icon: <Lightbulb className="w-4 h-4" />,
      label: t("task.feedback.intent.idea"),
    },
    {
      value: "positive",
      icon: <ThumbsUp className="w-4 h-4" />,
      label: t("task.feedback.intent.good"),
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-feedback-title"
        data-testid="task-feedback-modal"
      >
        <div className="absolute inset-0 bg-black/35" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="absolute left-1/2 top-1/2 w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[1.75rem] border shadow-2xl"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border-color)",
          }}
        >
          <div
            className="px-6 py-5 border-b flex items-center justify-between"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div className="min-w-0">
              <div
                id="task-feedback-title"
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {t("task.feedback.title")}
              </div>
              <div
                className="mt-1 text-[11px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {task.nodeLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close feedback modal"
              className="rounded-full border p-2"
              style={{
                backgroundColor: "var(--bg-primary)",
                borderColor: "var(--border-color)",
                color: "var(--text-secondary)",
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-5">
            <div
              className="rounded-2xl border px-4 py-4"
              style={{
                backgroundColor: "var(--bg-primary)",
                borderColor: "var(--border-color)",
              }}
            >
              <div
                className="text-[11px] uppercase tracking-[0.18em]"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("task.feedback.summary")}
              </div>
              <div
                className="mt-2 text-sm font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {task.resultSummary || task.command}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {actions.map((action) => (
                <button
                  key={action.value}
                  type="button"
                  onClick={() => setSentiment(action.value)}
                  className="rounded-2xl border px-4 py-4 text-left transition-all hover:-translate-y-0.5"
                  style={{
                    backgroundColor:
                      sentiment === action.value
                        ? "var(--bg-primary)"
                        : "transparent",
                    borderColor:
                      sentiment === action.value
                        ? "var(--node-run-border)"
                        : "var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                >
                  <div className="flex items-center gap-2">{action.icon}<span className="text-sm font-semibold">{action.label}</span></div>
                </button>
              ))}
            </div>

            <div>
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("task.feedback.artifacts")}
              </div>
              {artifacts.length > 0 ? (
                <div className="space-y-2">
                  {artifacts.slice(0, 4).map((artifact) => (
                    <button
                      key={`${artifact.key}-${artifact.path}`}
                      type="button"
                      onClick={() => onOpenPath(artifact.path)}
                      className="w-full rounded-xl border px-3 py-3 text-left"
                      style={{
                        backgroundColor: "var(--bg-primary)",
                        borderColor: "var(--border-color)",
                      }}
                    >
                      <div
                        className="text-[11px] font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {artifact.label}
                      </div>
                      <div
                        className="mt-1 text-[10px] break-all"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {artifact.path}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div
                  className="rounded-xl border px-3 py-3 text-[11px]"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {t("task.feedback.noArtifacts")}
                </div>
              )}
            </div>

            <div>
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("task.feedback.label")}
              </div>
              <textarea
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                placeholder={t("task.feedback.placeholder")}
                aria-label={t("task.feedback.label")}
                className="w-full min-h-[8rem] rounded-2xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--node-run-edge)]"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            {result && (
              <div
                className="rounded-2xl border px-4 py-4"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  borderColor: "var(--border-color)",
                }}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: "var(--node-run-text)" }} />
                  <div
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {t("task.feedback.saved")}
                  </div>
                </div>
                <div
                  className="mt-2 text-[11px] leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {result.summary}
                </div>
                {result.evolutionTaskId && (
                  <div
                    className="mt-3 rounded-xl border px-3 py-3"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4" style={{ color: "var(--node-run-text)" }} />
                      <div
                        className="text-[11px] font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {t("task.feedback.evolutionQueued")}
                      </div>
                    </div>
                    <div
                      className="mt-1 text-[10px] break-all"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {result.evolutionTaskId}
                    </div>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.evolutionTaskId && (
                    <button
                      type="button"
                      onClick={() => onViewEvolutionTask(result.evolutionTaskId!)}
                      className="rounded-full border px-3 py-2 text-[11px] font-medium"
                      style={{
                        backgroundColor: "var(--bg-secondary)",
                        borderColor: "var(--border-color)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {t("task.feedback.viewEvolutionTask")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenPath(result.feedbackPath)}
                    className="rounded-full border px-3 py-2 text-[11px] font-medium"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      borderColor: "var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {t("task.feedback.openFeedback")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenPath(result.evolutionPath)}
                    className="rounded-full border px-3 py-2 text-[11px] font-medium"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      borderColor: "var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {t("task.feedback.openEvolution")}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div
            className="px-6 py-5 border-t flex items-center justify-between gap-3"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div
              className="flex items-center gap-2 text-[11px]"
              style={{ color: "var(--text-secondary)" }}
            >
              <MessageSquareText className="w-4 h-4" />
              {t("task.feedback.hint")}
            </div>
            <button
              type="button"
              onClick={() => onSubmit({ sentiment, feedback })}
              disabled={submitting || !feedback.trim()}
              aria-label={t("task.feedback.submit")}
              className="rounded-full border px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
              style={{
                backgroundColor: "var(--bg-primary)",
                borderColor: "var(--border-color)",
                color: "var(--text-primary)",
              }}
            >
              {submitting ? t("task.feedback.submitting") : t("task.feedback.submit")}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
