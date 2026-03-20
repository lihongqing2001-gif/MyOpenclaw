import React from "react";
import { useI18n } from "../i18n";

export type EvidenceLevel = "confirmed" | "runtime" | "declared";

export interface EvidenceResult {
  id: string;
  title: string;
  level: EvidenceLevel;
  source?: string;
  type?: string;
  summary?: string;
  path?: string;
  link?: string;
}

export interface EvidenceSearchPanelProps {
  query: string;
  onQueryChange: (value: string) => void;
  loading: boolean;
  results: EvidenceResult[];
  selectedEvidenceFilter: EvidenceLevel | "all";
  onFilterChange: (value: EvidenceLevel | "all") => void;
  onSubmit: () => void;
  onOpenPath?: (path: string) => void;
  onOpenLink?: (link: string) => void;
}

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
  letterSpacing: "0.2em",
  textTransform: "uppercase",
};

const levelOrder: EvidenceLevel[] = ["confirmed", "runtime", "declared"];

const levelLabel: Record<EvidenceLevel, string> = {
  confirmed: "Confirmed",
  runtime: "Runtime",
  declared: "Declared",
};

const levelBadgeStyle = (level: EvidenceLevel): React.CSSProperties => {
  const shared: React.CSSProperties = {
    borderRadius: 999,
    padding: "3px 10px",
    fontSize: 10,
    textTransform: "uppercase",
    fontWeight: 600,
  };
  switch (level) {
    case "confirmed":
      return {
        ...shared,
        border: "1px solid rgba(52, 211, 153, 0.4)",
        color: "#34D399",
        backgroundColor: "rgba(52, 211, 153, 0.08)",
      };
    case "runtime":
      return {
        ...shared,
        border: "1px solid rgba(59, 130, 246, 0.4)",
        color: "#3B82F6",
        backgroundColor: "rgba(59, 130, 246, 0.08)",
      };
    default:
      return {
        ...shared,
        border: "1px solid var(--border-color)",
        color: "var(--text-secondary)",
        backgroundColor: "rgba(255, 255, 255, 0.03)",
      };
  }
};

const filterOptions: (EvidenceLevel | "all")[] = ["all", ...levelOrder];

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid var(--border-color)",
  backgroundColor: "rgba(255, 255, 255, 0.02)",
  color: "var(--text-primary)",
  padding: "10px 12px",
  fontSize: 14,
};

type EvidenceTone = "info" | "hint" | "success";

interface EvidenceStatusInfo {
  message: string;
  hint: string;
  tone: EvidenceTone;
}

const statusToneStyles: Record<EvidenceTone, React.CSSProperties> = {
  info: { color: "var(--node-run-text)" },
  success: { color: "#34D399" },
  hint: { color: "var(--text-secondary)" },
};

export const EvidenceSearchPanel = React.memo(function EvidenceSearchPanel({
  query,
  onQueryChange,
  loading,
  results,
  selectedEvidenceFilter,
  onFilterChange,
  onSubmit,
  onOpenPath,
  onOpenLink,
}: EvidenceSearchPanelProps) {
  const { t } = useI18n();
  const filteredResults =
    selectedEvidenceFilter === "all"
      ? results
      : results.filter((result) => result.level === selectedEvidenceFilter);

  const groupedResults = levelOrder.map((level) => ({
    level,
    items: filteredResults.filter((result) => result.level === level),
  }));

  const hasResults = filteredResults.length > 0;
  const canSearch = query.trim().length > 0;
  const levelLabel = (level: EvidenceLevel) => t(`evidence.level.${level}`);
  const statusInfo: EvidenceStatusInfo = loading
    ? {
        message: t("evidence.status.searching"),
        hint: t("evidence.status.searchingHint"),
        tone: "info",
      }
    : !canSearch
    ? {
        message: t("evidence.status.emptyQuery"),
        hint: t("evidence.status.emptyQueryHint"),
        tone: "hint",
      }
    : hasResults
    ? {
        message: t("evidence.status.results", { count: filteredResults.length }),
        hint:
          selectedEvidenceFilter === "all"
            ? t("evidence.status.resultsHint")
            : t("evidence.status.filteredHint", {
                level: levelLabel(selectedEvidenceFilter),
              }),
        tone: "success",
      }
    : {
        message: t("evidence.status.noMatch"),
        hint: t("evidence.status.noMatchHint"),
        tone: "hint",
      };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || !canSearch) {
      return;
    }
    onSubmit();
  };

  return (
    <section
      style={panelStyle}
      className="space-y-5"
      role="region"
      aria-labelledby="evidence-triage-title"
      aria-busy={loading}
      data-testid="evidence-search-panel"
    >
      <header className="space-y-1">
        <p
          id="evidence-triage-title"
          className="text-lg font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {t("evidence.title")}
        </p>
        <p className="text-[11px]" style={sectionTitleStyle}>
          {t("evidence.subtitle")}
        </p>
        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {t("evidence.description")}
        </p>
      </header>

      <form
        onSubmit={handleFormSubmit}
        className="space-y-3"
        role="search"
        aria-label={t("evidence.search.region")}
      >
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("evidence.search.placeholder")}
            style={inputStyle}
            aria-label={t("evidence.search.label")}
          />
          <button
            type="submit"
            className="rounded-2xl border px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: "var(--node-run-border)",
              background:
                "linear-gradient(180deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.05))",
              color: "var(--node-run-text)",
            }}
            disabled={loading || !canSearch}
          >
            {loading ? t("evidence.search.searching") : t("evidence.search.submit")}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => {
            const label = option === "all" ? t("evidence.filter.all") : levelLabel(option);
            const isActive = selectedEvidenceFilter === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onFilterChange(option)}
                aria-pressed={isActive}
                className="rounded-full border px-3 py-1 text-xs font-semibold uppercase transition hover:-translate-y-0.5"
                style={{
                  borderColor: isActive ? "var(--node-run-border)" : "var(--border-color)",
                  color: isActive ? "var(--node-run-text)" : "var(--text-secondary)",
                  backgroundColor: isActive ? "rgba(59, 130, 246, 0.12)" : "transparent",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </form>

      <div className="space-y-4" aria-live="polite">
        <div className="space-y-1 text-[10px] leading-snug">
          <p role="status" style={statusToneStyles[statusInfo.tone]}>
            {statusInfo.message}
          </p>
          <p style={{ color: "var(--text-secondary)" }}>{statusInfo.hint}</p>
        </div>
        {(loading || (canSearch && !hasResults)) && (
          <div
            className="rounded-2xl border px-4 py-4 text-sm"
            style={{
              borderColor: "var(--border-color)",
              background: "var(--panel-surface-soft)",
              color: "var(--text-secondary)",
            }}
          >
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {loading ? t("evidence.empty.loadingTitle") : t("evidence.empty.title")}
            </p>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-secondary)" }}>
              {loading
                ? t("evidence.empty.loadingBody")
                : t("evidence.empty.body")}
            </p>
          </div>
        )}

        {groupedResults.map(
          (group) =>
            group.items.length > 0 && (
              <div key={group.level} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span style={levelBadgeStyle(group.level)}>{levelLabel(group.level)}</span>
                    <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {t("evidence.hits", { count: group.items.length })}
                    </p>
                  </div>
                  <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {group.level === "confirmed"
                      ? t("evidence.verified")
                      : t("evidence.needsValidation")}
                  </p>
                </div>

                <div
                  className="space-y-3"
                  role="list"
                  aria-label={`${levelLabel(group.level)} evidence results`}
                >
                  {group.items.map((result) => (
                    <article
                      key={result.id}
                      role="listitem"
                      className="rounded-2xl border px-4 py-3"
                      style={{
                        borderColor: "var(--border-color)",
                        backgroundColor: "rgba(255, 255, 255, 0.01)",
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          {result.title}
                        </p>
                        <span style={levelBadgeStyle(result.level)}>
                          {levelLabel(result.level)}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {result.source && (
                          <span
                            className="rounded-full border px-3 py-1 text-[10px] font-semibold"
                            style={{
                              borderColor: "var(--border-color)",
                              color: "var(--text-secondary)",
                              backgroundColor: "rgba(255, 255, 255, 0.03)",
                            }}
                          >
                            {result.source}
                          </span>
                        )}
                        {result.type && (
                          <span
                            className="rounded-full border px-3 py-1 text-[10px] font-semibold"
                            style={{
                              borderColor: "var(--border-color)",
                              color: "var(--text-secondary)",
                              backgroundColor: "rgba(255, 255, 255, 0.03)",
                            }}
                          >
                            {result.type}
                          </span>
                        )}
                      </div>

                      {result.summary && (
                        <p className="mt-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                          {result.summary}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                        {result.path && (
                          <button
                            type="button"
                            onClick={() => onOpenPath?.(result.path)}
                            aria-label={`${t("evidence.action.openPath")} ${result.title}`}
                            className="rounded-full border px-3 py-1 font-semibold"
                            style={{
                              borderColor: "var(--border-color)",
                              color: "var(--text-primary)",
                              backgroundColor: "var(--bg-secondary)",
                            }}
                          >
                            {t("evidence.action.openPath")}
                          </button>
                        )}
                        {result.link && (
                          <button
                            type="button"
                            onClick={() => onOpenLink?.(result.link)}
                            aria-label={`${t("evidence.action.openLink")} ${result.title}`}
                            className="rounded-full border px-3 py-1 font-semibold"
                            style={{
                              borderColor: "var(--border-color)",
                              color: "var(--text-primary)",
                              backgroundColor: "var(--bg-secondary)",
                            }}
                          >
                            {t("evidence.action.openLink")}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ),
        )}
      </div>
    </section>
  );
});
