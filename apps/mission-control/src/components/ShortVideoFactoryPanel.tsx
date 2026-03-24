import React from "react";
import { FolderOpen, Sparkles, Clapperboard, UploadCloud, PlayCircle, BookmarkPlus } from "lucide-react";
import { ShortVideoFactoryState } from "../types";
import { useI18n } from "../i18n";

const panelStyle: React.CSSProperties = {
  background: "var(--panel-surface)",
  border: "1px solid var(--border-color)",
  borderRadius: 18,
  padding: 20,
  boxShadow: "var(--panel-shadow)",
};

const labelStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid var(--border-color)",
  backgroundColor: "var(--bg-secondary)",
  color: "var(--text-primary)",
  padding: "10px 12px",
  fontSize: 13,
};

const actionButtonStyle: React.CSSProperties = {
  borderRadius: 999,
  border: "1px solid var(--border-color)",
  backgroundColor: "rgba(59, 130, 246, 0.12)",
  color: "var(--text-primary)",
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 600,
};

const secondaryButtonStyle: React.CSSProperties = {
  ...actionButtonStyle,
  backgroundColor: "transparent",
  color: "var(--text-secondary)",
};

export interface ShortVideoFactoryPanelProps {
  factoryState: ShortVideoFactoryState;
  sampleBatchForm: {
    platform: string;
    accountName: string;
    accountHandle: string;
    objective: string;
    sampleSize: number;
    linksText: string;
  };
  creativeForm: {
    selectedContentIds: string;
    targetPlatform: string;
    targetGoal: string;
    imitationStrategy: string;
    tone: string;
    durationTarget: number;
    generateAiClips: boolean;
  };
  insightForm: {
    videoUrl: string;
    objective: string;
    reflectionNote: string;
    collectionName: string;
  };
  loadingAction: "batch" | "research" | "brief" | "production" | "insight" | "notebooklm" | null;
  errorMessage?: string;
  successMessage?: string;
  onSampleBatchFormChange: (patch: Partial<ShortVideoFactoryPanelProps["sampleBatchForm"]>) => void;
  onCreativeFormChange: (patch: Partial<ShortVideoFactoryPanelProps["creativeForm"]>) => void;
  onInsightFormChange: (patch: Partial<ShortVideoFactoryPanelProps["insightForm"]>) => void;
  onCreateBatch: () => void;
  onRunResearch: () => void;
  onGenerateBrief: () => void;
  onRunNotebooklmEnhance: () => void;
  onRunProduction: () => void;
  onCaptureInsight: () => void;
  onOpenPath?: (path: string, options?: { reveal?: boolean }) => void;
}

const GateBadge = ({
  status,
  label,
}: {
  status: ShortVideoFactoryState["gates"][number]["status"];
  label: string;
}) => {
  const tone =
    status === "completed"
      ? { borderColor: "rgba(52, 211, 153, 0.4)", color: "#34D399" }
      : status === "ready"
        ? { borderColor: "rgba(59, 130, 246, 0.4)", color: "var(--node-run-border)" }
        : status === "blocked"
          ? { borderColor: "rgba(239, 68, 68, 0.4)", color: "var(--node-err-text)" }
          : { borderColor: "var(--border-color)", color: "var(--text-secondary)" };
  return (
    <span
      className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase"
      style={{ backgroundColor: "var(--bg-secondary)", ...tone }}
    >
      {label}
    </span>
  );
};

export const ShortVideoFactoryPanel = React.memo(function ShortVideoFactoryPanel({
  factoryState,
  sampleBatchForm,
  creativeForm,
  insightForm,
  loadingAction,
  errorMessage,
  successMessage,
  onSampleBatchFormChange,
  onCreativeFormChange,
  onInsightFormChange,
  onCreateBatch,
  onRunResearch,
  onGenerateBrief,
  onRunNotebooklmEnhance,
  onRunProduction,
  onCaptureInsight,
  onOpenPath,
}: ShortVideoFactoryPanelProps) {
  const { t } = useI18n();
  const gateStatusLabel = (status: ShortVideoFactoryState["gates"][number]["status"]) => {
    const map: Record<string, string> = {
      pending: t("shortVideoFactory.status.pending"),
      ready: t("shortVideoFactory.status.ready"),
      blocked: t("shortVideoFactory.status.blocked"),
      completed: t("shortVideoFactory.status.completed"),
    };
    return map[status] ?? status;
  };

  const latestArtifacts = [
    factoryState.latestSampleBatch,
    factoryState.latestResearchBundle,
    factoryState.latestCreativeBrief,
    factoryState.latestProductionPack,
    factoryState.latestRoughCut,
    factoryState.latestInspirationRecord,
    factoryState.latestNotebookSummary,
    factoryState.latestNotebookEnhancedBrief,
  ].filter(Boolean);

  return (
    <section
      style={panelStyle}
      className="space-y-5"
      role="region"
      aria-labelledby="short-video-factory-title"
      data-testid="short-video-factory-panel"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p id="short-video-factory-title" className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {t("shortVideoFactory.title")}
          </p>
          <p className="text-[11px]" style={labelStyle}>
            {t("shortVideoFactory.subtitle")}
          </p>
        </div>
        <div
          className="rounded-2xl border px-3 py-2 text-[11px]"
          style={{
            borderColor: "var(--border-color)",
            backgroundColor: "var(--bg-secondary)",
            color: "var(--text-secondary)",
          }}
        >
          {t("shortVideoFactory.defaults", {
            min: factoryState.minSampleSize,
            count: factoryState.defaultSampleSize,
          })}
        </div>
      </header>

      <div
        className="rounded-2xl border px-4 py-4"
        style={{
          borderColor: "var(--border-color)",
          background: "var(--panel-surface-soft)",
        }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("shortVideoFactory.chainTitle")}
        </p>
        <p className="mt-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
          {t("shortVideoFactory.chainBody")}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4" style={{ color: "var(--node-run-border)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {t("shortVideoFactory.section.batch")}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span style={labelStyle}>{t("shortVideoFactory.field.platform")}</span>
              <select
                value={sampleBatchForm.platform}
                onChange={(event) => onSampleBatchFormChange({ platform: event.target.value })}
                style={inputStyle}
              >
                <option value="mixed">{t("shortVideoFactory.platform.mixed")}</option>
                <option value="douyin">{t("shortVideoFactory.platform.douyin")}</option>
                <option value="xiaohongshu">{t("shortVideoFactory.platform.xiaohongshu")}</option>
              </select>
            </label>
            <label className="space-y-1">
              <span style={labelStyle}>{t("shortVideoFactory.field.sampleSize")}</span>
              <input
                type="number"
                min={factoryState.minSampleSize}
                value={sampleBatchForm.sampleSize}
                onChange={(event) =>
                  onSampleBatchFormChange({ sampleSize: Number(event.target.value) || factoryState.defaultSampleSize })
                }
                style={inputStyle}
              />
            </label>
            <label className="space-y-1">
              <span style={labelStyle}>{t("shortVideoFactory.field.accountName")}</span>
              <input
                value={sampleBatchForm.accountName}
                onChange={(event) => onSampleBatchFormChange({ accountName: event.target.value })}
                style={inputStyle}
              />
            </label>
            <label className="space-y-1">
              <span style={labelStyle}>{t("shortVideoFactory.field.accountHandle")}</span>
              <input
                value={sampleBatchForm.accountHandle}
                onChange={(event) => onSampleBatchFormChange({ accountHandle: event.target.value })}
                style={inputStyle}
              />
            </label>
          </div>
          <label className="space-y-1">
            <span style={labelStyle}>{t("shortVideoFactory.field.objective")}</span>
            <input
              value={sampleBatchForm.objective}
              onChange={(event) => onSampleBatchFormChange({ objective: event.target.value })}
              style={inputStyle}
            />
          </label>
          <label className="space-y-1">
            <span style={labelStyle}>{t("shortVideoFactory.field.links")}</span>
            <textarea
              value={sampleBatchForm.linksText}
              onChange={(event) => onSampleBatchFormChange({ linksText: event.target.value })}
              rows={6}
              style={{ ...inputStyle, resize: "vertical" }}
              placeholder={t("shortVideoFactory.field.linksPlaceholder")}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onCreateBatch} style={actionButtonStyle} disabled={loadingAction === "batch"}>
              {loadingAction === "batch" ? t("shortVideoFactory.action.creating") : t("shortVideoFactory.action.createBatch")}
            </button>
            <button type="button" onClick={onRunResearch} style={secondaryButtonStyle} disabled={loadingAction === "research"}>
              {loadingAction === "research" ? t("shortVideoFactory.action.queueingResearch") : t("shortVideoFactory.action.runResearch")}
            </button>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-2">
            <Clapperboard className="h-4 w-4" style={{ color: "var(--node-run-border)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {t("shortVideoFactory.section.production")}
            </p>
          </div>
          <label className="space-y-1">
            <span style={labelStyle}>{t("shortVideoFactory.field.selectedContentIds")}</span>
            <input
              value={creativeForm.selectedContentIds}
              onChange={(event) => onCreativeFormChange({ selectedContentIds: event.target.value })}
              style={inputStyle}
              placeholder={t("shortVideoFactory.field.selectedContentIdsPlaceholder")}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span style={labelStyle}>{t("shortVideoFactory.field.targetPlatform")}</span>
              <select
                value={creativeForm.targetPlatform}
                onChange={(event) => onCreativeFormChange({ targetPlatform: event.target.value })}
                style={inputStyle}
              >
                <option value="douyin">{t("shortVideoFactory.platform.douyin")}</option>
                <option value="xiaohongshu">{t("shortVideoFactory.platform.xiaohongshu")}</option>
              </select>
            </label>
            <label className="space-y-1">
              <span style={labelStyle}>{t("shortVideoFactory.field.durationTarget")}</span>
              <input
                type="number"
                value={creativeForm.durationTarget}
                onChange={(event) => onCreativeFormChange({ durationTarget: Number(event.target.value) || 35 })}
                style={inputStyle}
              />
            </label>
          </div>
          <label className="space-y-1">
            <span style={labelStyle}>{t("shortVideoFactory.field.targetGoal")}</span>
            <input
              value={creativeForm.targetGoal}
              onChange={(event) => onCreativeFormChange({ targetGoal: event.target.value })}
              style={inputStyle}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span style={labelStyle}>{t("shortVideoFactory.field.imitationStrategy")}</span>
              <select
                value={creativeForm.imitationStrategy}
                onChange={(event) => onCreativeFormChange({ imitationStrategy: event.target.value })}
                style={inputStyle}
              >
                <option value="结构模仿">{t("shortVideoFactory.strategy.structure")}</option>
                <option value="主题模仿">{t("shortVideoFactory.strategy.theme")}</option>
                <option value="情绪模仿">{t("shortVideoFactory.strategy.emotion")}</option>
                <option value="镜头模仿">{t("shortVideoFactory.strategy.visual")}</option>
              </select>
            </label>
            <label className="space-y-1">
              <span style={labelStyle}>{t("shortVideoFactory.field.tone")}</span>
              <input
                value={creativeForm.tone}
                onChange={(event) => onCreativeFormChange({ tone: event.target.value })}
                style={inputStyle}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>
            <input
              type="checkbox"
              checked={creativeForm.generateAiClips}
              onChange={(event) => onCreativeFormChange({ generateAiClips: event.target.checked })}
            />
            {t("shortVideoFactory.field.generateAiClips")}
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onGenerateBrief} style={actionButtonStyle} disabled={loadingAction === "brief"}>
              {loadingAction === "brief" ? t("shortVideoFactory.action.queueingBrief") : t("shortVideoFactory.action.generateBrief")}
            </button>
            <button type="button" onClick={onRunNotebooklmEnhance} style={secondaryButtonStyle} disabled={loadingAction === "notebooklm"}>
              {loadingAction === "notebooklm" ? t("shortVideoFactory.action.queueingNotebooklm") : t("shortVideoFactory.action.runNotebooklm")}
            </button>
            <button type="button" onClick={onRunProduction} style={secondaryButtonStyle} disabled={loadingAction === "production"}>
              {loadingAction === "production" ? t("shortVideoFactory.action.queueingProduction") : t("shortVideoFactory.action.runProduction")}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center gap-2">
          <BookmarkPlus className="h-4 w-4" style={{ color: "var(--node-run-border)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {t("shortVideoFactory.section.inspiration")}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 md:col-span-2">
            <span style={labelStyle}>{t("shortVideoFactory.field.savedVideoUrl")}</span>
            <input
              value={insightForm.videoUrl}
              onChange={(event) => onInsightFormChange({ videoUrl: event.target.value })}
              style={inputStyle}
              placeholder={t("shortVideoFactory.field.savedVideoUrlPlaceholder")}
            />
          </label>
          <label className="space-y-1">
            <span style={labelStyle}>{t("shortVideoFactory.field.collectionName")}</span>
            <input
              value={insightForm.collectionName}
              onChange={(event) => onInsightFormChange({ collectionName: event.target.value })}
              style={inputStyle}
            />
          </label>
          <label className="space-y-1">
            <span style={labelStyle}>{t("shortVideoFactory.field.insightObjective")}</span>
            <input
              value={insightForm.objective}
              onChange={(event) => onInsightFormChange({ objective: event.target.value })}
              style={inputStyle}
            />
          </label>
        </div>
        <label className="space-y-1">
          <span style={labelStyle}>{t("shortVideoFactory.field.reflectionNote")}</span>
          <textarea
            value={insightForm.reflectionNote}
            onChange={(event) => onInsightFormChange({ reflectionNote: event.target.value })}
            rows={4}
            style={{ ...inputStyle, resize: "vertical" }}
            placeholder={t("shortVideoFactory.field.reflectionNotePlaceholder")}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onCaptureInsight} style={actionButtonStyle} disabled={loadingAction === "insight"}>
            {loadingAction === "insight" ? t("shortVideoFactory.action.queueingInsight") : t("shortVideoFactory.action.captureInsight")}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(239, 68, 68, 0.4)", color: "var(--node-err-text)" }}>
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(59, 130, 246, 0.4)", color: "var(--node-run-border)" }}>
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: "var(--border-color)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {t("shortVideoFactory.section.gates")}
          </p>
          <div className="space-y-2">
            {factoryState.gates.map((gate) => (
              <div
                key={gate.id}
                className="rounded-2xl border px-3 py-3"
                style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(255,255,255,0.01)" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {gate.label}
                  </p>
                  <GateBadge status={gate.status} label={gateStatusLabel(gate.status)} />
                </div>
                <p className="mt-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                  {gate.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: "var(--border-color)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {t("shortVideoFactory.section.latest")}
          </p>
          {latestArtifacts.length === 0 ? (
            <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
              {t("shortVideoFactory.latest.empty")}
            </p>
          ) : (
            latestArtifacts.map((artifact) => (
              <div
                key={`${artifact?.label}-${artifact?.path}`}
                className="rounded-2xl border px-3 py-3"
                style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(255,255,255,0.01)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                      {artifact?.label}
                    </p>
                    <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {artifact?.path}
                    </p>
                  </div>
                  <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    {artifact?.updatedAt ? artifact.updatedAt.replace("T", " ").slice(0, 16) : ""}
                  </span>
                </div>
                {artifact?.path && onOpenPath ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => onOpenPath(artifact.path)} style={secondaryButtonStyle}>
                      <FolderOpen className="mr-1 inline h-3.5 w-3.5" />
                      {t("shortVideoFactory.action.openArtifact")}
                    </button>
                    <button type="button" onClick={() => onOpenPath(artifact.path, { reveal: true })} style={secondaryButtonStyle}>
                      <PlayCircle className="mr-1 inline h-3.5 w-3.5" />
                      {t("shortVideoFactory.action.revealArtifact")}
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {!factoryState.geminiConsentGranted ? (
        <div
          className="rounded-2xl border px-4 py-4"
          style={{
            borderColor: "rgba(239, 68, 68, 0.25)",
            backgroundColor: "rgba(239, 68, 68, 0.06)",
            color: "var(--text-secondary)",
          }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: "var(--node-err-text)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {t("shortVideoFactory.warning.title")}
            </p>
          </div>
          <p className="mt-1 text-[12px]">{t("shortVideoFactory.warning.body")}</p>
        </div>
      ) : null}
    </section>
  );
});
