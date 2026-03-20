import React, { useState } from "react";
import { useI18n } from "../i18n";

type BadgeSource = "status" | "evidence";

export interface DecisionItem {
  id: string;
  priority: number;
  title: string;
  reason: string;
  nextAction: string;
  statusLabels?: string[];
  evidenceLabels?: string[];
  refs?: string[];
  ctaLabel?: string;
  onActionClick?: () => void;
}

export interface DecisionQueuePanelProps {
  decisions: DecisionItem[];
}

type QueueTone = "info" | "hint";

interface QueueStatusInfo {
  message: string;
  hint: string;
  tone: QueueTone;
}

const queueToneStyles: Record<QueueTone, React.CSSProperties> = {
  info: { color: "var(--node-run-text)" },
  hint: { color: "var(--text-secondary)" },
};

const panelStyle: React.CSSProperties = {
  background: "var(--panel-surface)",
  border: "1px solid var(--border-color)",
  borderRadius: 18,
  padding: 20,
  boxShadow: "var(--panel-shadow)",
};

const sectionTitleStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: 11,
  letterSpacing: "0.19em",
  textTransform: "uppercase",
};

const badgeSharedStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  borderRadius: 999,
  padding: "4px 10px",
};

const getPriorityVariant = (priority: number): React.CSSProperties => {
  if (priority <= 2) {
    return {
      backgroundColor: "rgba(239, 68, 68, 0.12)",
      border: "1px solid rgba(239, 68, 68, 0.4)",
      color: "var(--node-err-text)",
    };
  }
  if (priority <= 4) {
    return {
      backgroundColor: "rgba(59, 130, 246, 0.12)",
      border: "1px solid rgba(59, 130, 246, 0.4)",
      color: "var(--node-run-border)",
    };
  }
  return {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    border: "1px solid var(--border-color)",
    color: "var(--text-secondary)",
  };
};

const badgeStyle = (source: BadgeSource): React.CSSProperties => ({
  ...badgeSharedStyle,
  border: "1px solid var(--border-color)",
  backgroundColor:
    source === "status"
      ? "rgba(59, 130, 246, 0.12)"
      : "rgba(255, 255, 255, 0.04)",
  color: source === "status" ? "var(--node-run-border)" : "var(--text-secondary)",
});

export const DecisionQueuePanel = React.memo(function DecisionQueuePanel({ decisions }: DecisionQueuePanelProps) {
  const { t } = useI18n();
  const [showAll, setShowAll] = useState(false);
  const sortedDecisions = [...decisions].sort((a, b) => a.priority - b.priority);
  const hasDecisions = sortedDecisions.length > 0;
  const visibleDecisions = showAll ? sortedDecisions : sortedDecisions.slice(0, 3);
  const localizeTitle = (title: string) => {
    const map: Record<string, string> = {
      "Blocked Workflow": t("decisionQueue.title.blocked"),
      "Asset Root Needed": t("decisionQueue.title.assetRoot"),
      "Evidence Needs Refresh": t("decisionQueue.title.evidence"),
      "Failure Cluster": t("decisionQueue.title.failureCluster"),
      "Queued Follow-up": t("decisionQueue.title.followUp"),
      Decision: t("decisionQueue.title.default"),
    };
    return map[title] ?? title;
  };
  const localizeStatus = (label: string) => {
    const normalized = label.toLowerCase();
    if (normalized === "open") {
      return t("decisionQueue.status.open");
    }
    if (normalized === "watch") {
      return t("decisionQueue.status.watch");
    }
    if (normalized === "resolved") {
      return t("decisionQueue.status.resolved");
    }
    return label;
  };
  const localizeEvidence = (label: string) => {
    const normalized = label.toLowerCase();
    if (normalized === "runtime") {
      return t("decisionQueue.evidence.runtime");
    }
    if (normalized === "declared") {
      return t("decisionQueue.evidence.declared");
    }
    if (normalized === "confirmed") {
      return t("decisionQueue.evidence.confirmed");
    }
    return label;
  };
  const queueStatus: QueueStatusInfo = hasDecisions
    ? {
        message: t("decisionQueue.summary.showing", { count: sortedDecisions.length }),
        hint: t("decisionQueue.summary.showingHint"),
        tone: "info",
      }
    : {
        message: t("decisionQueue.summary.empty"),
        hint: t("decisionQueue.summary.emptyHint"),
        tone: "hint",
      };

  return (
    <section
      style={panelStyle}
      className="space-y-5"
      role="region"
      aria-labelledby="decision-queue-title"
      data-testid="decision-queue-panel"
    >
      <header className="flex items-center justify-between">
        <div>
          <p
            id="decision-queue-title"
            className="text-lg font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {t("decisionQueue.title")}
          </p>
          <p className="text-[11px]" style={sectionTitleStyle}>
            {t("decisionQueue.subtitle")}
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-[11px] font-semibold"
          style={{
            border: "1px solid var(--border-color)",
            color: "var(--text-secondary)",
            backgroundColor: "var(--bg-secondary)",
          }}
        >
          {t("decisionQueue.pending", { count: decisions.length })}
        </span>
      </header>

      <div
        className="text-[10px] leading-snug"
        aria-live="polite"
      >
        <p role="status" style={queueToneStyles[queueStatus.tone]}>
          {queueStatus.message}
        </p>
        <p style={{ color: "var(--text-secondary)" }}>{queueStatus.hint}</p>
      </div>

      {sortedDecisions.length === 0 ? (
        <div
          className="rounded-2xl border px-4 py-5 text-sm"
          style={{
            borderColor: "var(--border-color)",
            backgroundColor: "rgba(255, 255, 255, 0.01)",
            color: "var(--text-secondary)",
          }}
          >
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {t("decisionQueue.empty.title")}
            </p>
            <p className="text-[11px] mt-1">
              {t("decisionQueue.empty.body")}
            </p>
          </div>
      ) : (
        <div className="space-y-3" role="list" aria-label="Decision queue items">
          {visibleDecisions.map((decision) => (
            <article
              key={decision.id}
              role="listitem"
              className="rounded-2xl border px-4 py-3"
              style={{
                borderColor: "var(--border-color)",
                backgroundColor: "rgba(255, 255, 255, 0.01)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {localizeTitle(decision.title)}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {decision.reason}
                  </p>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-semibold"
                  style={{
                    ...badgeSharedStyle,
                    ...getPriorityVariant(decision.priority),
                    textTransform: "none",
                    padding: "4px 11px",
                  }}
                >
                  P{decision.priority}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {(decision.statusLabels ?? []).map((label) => (
                    <span key={`status-${label}`} style={badgeStyle("status")}>
                      {localizeStatus(label)}
                    </span>
                  ))}
                  {(decision.evidenceLabels ?? []).map((label) => (
                    <span key={`evidence-${label}`} style={badgeStyle("evidence")}>
                      {localizeEvidence(label)}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                  {t("decisionQueue.next", { next: decision.nextAction })}
                </p>
              </div>

              {decision.refs && decision.refs.length > 0 && (
                <p className="mt-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  {t("decisionQueue.references", { refs: decision.refs.join(" · ") })}
                </p>
              )}

              {decision.onActionClick && decision.ctaLabel && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={decision.onActionClick}
                    aria-label={decision.ctaLabel ? `${decision.ctaLabel} for ${decision.title}` : undefined}
                    className="rounded-full border px-4 py-1 text-[11px] font-semibold transition hover:-translate-y-0.5"
                    style={{
                      borderColor: "var(--border-hover)",
                      backgroundColor: "var(--bg-secondary)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {decision.ctaLabel}
                  </button>
                </div>
              )}
            </article>
          ))}
              {sortedDecisions.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAll((current) => !current)}
              className="w-full rounded-xl border px-3 py-2 text-[11px] font-medium"
              style={{
                backgroundColor: "var(--bg-secondary)",
                borderColor: "var(--border-color)",
                color: "var(--text-primary)",
              }}
            >
              {showAll
                ? t("decisionQueue.action.showLess")
                : t("decisionQueue.action.showMore", {
                    count: sortedDecisions.length - visibleDecisions.length,
                  })}
            </button>
          )}
        </div>
      )}
    </section>
  );
});
