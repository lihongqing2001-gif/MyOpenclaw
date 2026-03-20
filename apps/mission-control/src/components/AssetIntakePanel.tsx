import React from "react";
import { useI18n } from "../i18n";

type IntakeAction = "organize" | "index" | "fullIntake";

export interface AssetRootSummary {
  path: string;
  source: string;
  configured: boolean;
  freshnessLabel?: string;
  description?: string;
}

export interface AssetIntakePanelProps {
  assetRoot: AssetRootSummary;
  suggestedAssetRootPath?: string;
  namingContractLines: string[];
  onAdoptSuggestedRoot?: () => void;
  targetDirectory: string;
  archiveRuleNote: string;
  onTargetDirectoryChange: (value: string) => void;
  onArchiveRuleNoteChange: (value: string) => void;
  onQueueOrganize: () => void;
  onQueueIndex: () => void;
  onQueueFullIntake: () => void;
  loadingAction?: IntakeAction | null;
  errorMessage?: string;
  lastActionMessage?: string;
}

type StatusTone = "info" | "success" | "error" | "hint";
type StatusRole = "status" | "alert";

interface PanelStatus {
  message: string;
  hint: string;
  tone: StatusTone;
  role: StatusRole;
}

const statusToneStyles: Record<StatusTone, React.CSSProperties> = {
  info: { color: "var(--node-run-text)" },
  success: { color: "#34D399" },
  error: { color: "var(--node-err-text)" },
  hint: { color: "var(--text-secondary)" },
};

const panelStyle: React.CSSProperties = {
  background: "var(--panel-surface)",
  border: "1px solid var(--border-color)",
  borderRadius: 18,
  padding: 22,
  boxShadow: "var(--panel-shadow)",
};

const sectionTitleStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: 11,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

const inputBaseStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid var(--border-color)",
  backgroundColor: "rgba(255, 255, 255, 0.02)",
  color: "var(--text-primary)",
  padding: "10px 12px",
  fontSize: 14,
};

export const AssetIntakePanel = React.memo(function AssetIntakePanel({
  assetRoot,
  suggestedAssetRootPath,
  namingContractLines,
  onAdoptSuggestedRoot,
  targetDirectory,
  archiveRuleNote,
  onTargetDirectoryChange,
  onArchiveRuleNoteChange,
  onQueueOrganize,
  onQueueIndex,
  onQueueFullIntake,
  loadingAction = null,
  errorMessage,
  lastActionMessage,
}: AssetIntakePanelProps) {
  const { t } = useI18n();
  const actionTitles: Record<IntakeAction, string> = {
    organize: t("assetIntake.step.organize.label"),
    index: t("assetIntake.step.index.label"),
    fullIntake: t("assetIntake.queue.full"),
  };
  const pipelineSteps: {
    action: IntakeAction;
    label: string;
    description: string;
    buttonLabel: string;
    handler: () => void;
  }[] = [
    {
      action: "organize",
      label: t("assetIntake.step.organize.label"),
      description: t("assetIntake.step.organize.description"),
      buttonLabel: t("assetIntake.step.organize.button"),
      handler: onQueueOrganize,
    },
    {
      action: "index",
      label: t("assetIntake.step.index.label"),
      description: t("assetIntake.step.index.description"),
      buttonLabel: t("assetIntake.step.index.button"),
      handler: onQueueIndex,
    },
  ];

  const isBusy = Boolean(loadingAction);
  const activeActionLabel = loadingAction ? actionTitles[loadingAction] : null;
  const canQueue = targetDirectory.trim().length > 0;

  const statusInfo: PanelStatus = loadingAction
    ? {
        message: t("assetIntake.status.queueing", {
          action: activeActionLabel ?? t("assetIntake.queue.full"),
        }),
        hint: t("assetIntake.status.queueing.hint"),
        tone: "info",
        role: "status",
      }
    : errorMessage
    ? {
        message: t("assetIntake.status.error", { error: errorMessage }),
        hint: t("assetIntake.status.error.hint"),
        tone: "error",
        role: "alert",
      }
    : lastActionMessage
    ? {
        message: t("assetIntake.status.lastAction", { message: lastActionMessage }),
        hint: t("assetIntake.status.lastAction.hint"),
        tone: "success",
        role: "status",
      }
    : {
        message: t("assetIntake.status.ready"),
        hint: t("assetIntake.status.ready.hint"),
        tone: "hint",
        role: "status",
      };

  return (
    <section
      style={panelStyle}
      className="space-y-6"
      role="region"
      aria-labelledby="asset-intake-title"
      aria-busy={isBusy}
      data-testid="asset-intake-panel"
    >
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              id="asset-intake-title"
              className="text-lg font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {t("assetIntake.title")}
            </p>
            <p className="text-xs" style={sectionTitleStyle}>
              {t("assetIntake.subtitle")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className="rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-secondary)",
                color: assetRoot.configured
                  ? "var(--text-secondary)"
                  : "var(--node-err-text)",
              }}
            >
              {assetRoot.configured
                ? t("assetIntake.state.configured")
                : t("assetIntake.state.notConfigured")}
            </span>
            {assetRoot.description && (
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {assetRoot.description}
              </p>
            )}
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {assetRoot.path}
          </p>
          <p style={{ color: "var(--text-secondary)" }}>
            {t("assetIntake.source", {
              source: t(`assetIntake.sourceValue.${assetRoot.source}`),
            })}
          </p>
          {assetRoot.freshnessLabel && (
            <p style={{ color: "var(--text-secondary)" }}>
              {assetRoot.freshnessLabel}
            </p>
          )}
          {suggestedAssetRootPath && (
            <div className="flex flex-wrap items-center gap-2">
              <p
                className="text-[11px] rounded-full border px-3 py-1"
                style={{
                  borderColor: "var(--border-hover)",
                  color: "var(--text-secondary)",
                  display: "inline-block",
                }}
              >
                {t("assetIntake.suggestedRoot", {
                  path: suggestedAssetRootPath,
                })}
              </p>
              {onAdoptSuggestedRoot && (
                <button
                  type="button"
                  onClick={onAdoptSuggestedRoot}
                  aria-label={t("assetIntake.adoptSuggested")}
                  className="rounded-full border px-3 py-1 text-[11px] font-semibold transition hover:-translate-y-0.5"
                  style={{
                    borderColor: "var(--node-run-border)",
                    color: "var(--node-run-text)",
                    backgroundColor: "rgba(59, 130, 246, 0.12)",
                  }}
                >
                  {t("assetIntake.adoptSuggested")}
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="space-y-3">
        <div className="justify-between">
          <p className="text-[11px] font-semibold" style={sectionTitleStyle}>
            {t("assetIntake.namingContract")}
          </p>
        </div>
        {namingContractLines.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("assetIntake.namingContract.empty")}
          </p>
        ) : (
          <div
            className="rounded-2xl border px-3 py-3"
            style={{
              borderColor: "var(--border-color)",
              background: "var(--panel-surface-soft)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {namingContractLines[0]}
            </p>
            {namingContractLines.length > 1 && (
              <p className="mt-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {t("assetIntake.namingContract.more", {
                  count: namingContractLines.length - 1,
                })}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="asset-intake-target-directory"
            className="text-[11px] font-semibold"
            style={sectionTitleStyle}
          >
            {t("assetIntake.targetDirectory")}
          </label>
          <input
            id="asset-intake-target-directory"
            value={targetDirectory}
            onChange={(event) => onTargetDirectoryChange(event.target.value)}
            placeholder={t("assetIntake.targetDirectory.placeholder")}
            style={inputBaseStyle}
            aria-required="true"
            aria-label={t("assetIntake.targetDirectory")}
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="asset-intake-archive-rule"
            className="text-[11px] font-semibold"
            style={sectionTitleStyle}
          >
            {t("assetIntake.archiveRule")}
          </label>
          <textarea
            id="asset-intake-archive-rule"
            value={archiveRuleNote}
            onChange={(event) => onArchiveRuleNoteChange(event.target.value)}
            placeholder={t("assetIntake.archiveRule.placeholder")}
            rows={2}
            style={{
              ...inputBaseStyle,
              resize: "vertical",
              minHeight: 64,
            }}
            aria-label={t("assetIntake.archiveRule")}
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold" style={sectionTitleStyle}>
            {t("assetIntake.pipeline")}
          </p>
          {activeActionLabel && (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {t("assetIntake.status.queueing", { action: activeActionLabel })}
            </p>
          )}
        </div>
        <div className="space-y-3 pt-3">
          {pipelineSteps.map((step) => (
            <div
              key={step.action}
              className="flex flex-col gap-2 rounded-2xl border px-4 py-3"
              style={{
                borderColor: "var(--border-color)",
                background: "var(--panel-surface-soft)",
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    {step.label}
                  </p>
                  <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                    {step.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={step.handler}
                  disabled={isBusy || !canQueue}
                  aria-label={step.buttonLabel}
                  className="rounded-full border px-4 py-1 text-[11px] font-semibold transition hover:-translate-y-0.5 disabled:opacity-40"
                  style={{
                    borderColor: "var(--border-color)",
                    color: "var(--text-secondary)",
                    backgroundColor: "transparent",
                  }}
                >
                  {step.buttonLabel}
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onQueueFullIntake}
          disabled={isBusy || !canQueue}
          aria-label={t("assetIntake.queue.full")}
          className="w-full rounded-2xl border px-4 py-2 text-sm font-semibold tracking-wide transition hover:-translate-y-0.5 disabled:opacity-40"
          style={{
            borderColor: "var(--node-run-border)",
            background:
              "linear-gradient(180deg, rgba(59, 130, 246, 0.18), rgba(59, 130, 246, 0.04))",
            color: "var(--node-run-text)",
            marginTop: 8,
          }}
        >
          {t("assetIntake.queue.full")}
        </button>
      </div>

      <div
        className="space-y-1 text-xs"
        aria-live={statusInfo.role === "alert" ? "assertive" : "polite"}
      >
        <p role={statusInfo.role} style={statusToneStyles[statusInfo.tone]}>
          {statusInfo.message}
        </p>
        <p style={{ color: "var(--text-secondary)" }}>{statusInfo.hint}</p>
      </div>
    </section>
  );
});
