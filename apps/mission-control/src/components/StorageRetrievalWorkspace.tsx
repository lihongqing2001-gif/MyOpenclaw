import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  FileUp,
  FolderInput,
  Link2,
  RefreshCcw,
  Search,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { AssetRootConfig, AgentTask } from "../types";
import {
  fetchStorageRetrievalRecent,
  importStorageRetrieval,
  queueAssetIntake,
  reclassifyStorageRetrievalImportItem,
  searchStorageRetrieval,
} from "../services/api";
import { useI18n } from "../i18n";

type StorageTab = "import" | "search" | "recent" | "settings";
type SearchScope = "all" | "assets" | "knowledge";
type SearchType = "all" | "image" | "video" | "document" | "knowledge" | "directory" | "data";

type SearchResult = {
  id: string;
  title: string;
  kind: "asset" | "knowledge";
  fileType: SearchType | string;
  resultClass?: "deliverable" | "asset" | "raw" | "knowledge" | "runtime-log";
  path: string;
  summary?: string;
  updatedAt?: string;
  projectSeries?: string;
  platform?: string;
  linkedKnowledgePath?: string;
};

type RecentImport = {
  id: string;
  importedAt: string;
  manifestPath: string;
  knowledgeNotePath?: string;
  summary: string;
};

type ImportSummaryItem = {
  source: string;
  sourceKind: "path" | "link" | "upload";
  classifiedAs: string;
  projectFolder?: string;
  workflow?: string;
  stage?: string;
  matchedByMemory?: boolean;
  targetBucket: string;
  action: "copied" | "referenced";
  confidence: "high" | "medium" | "low";
  storedAt?: string;
  warning?: string;
};

type ImportResult = {
  success: boolean;
  summary: string;
  manifestPath: string;
  knowledgeNotePath?: string;
  importedAt: string;
  items: ImportSummaryItem[];
};

type DroppedFile = {
  name: string;
  relativePath: string;
  contentBase64: string;
};

const panelStyle: React.CSSProperties = {
  background: "var(--panel-surface)",
  border: "1px solid var(--border-color)",
  borderRadius: 18,
  padding: 20,
  boxShadow: "var(--panel-shadow)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid var(--border-color)",
  backgroundColor: "rgba(255, 255, 255, 0.02)",
  color: "var(--text-primary)",
  padding: "10px 12px",
  fontSize: 14,
};

const sectionTitleStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: 11,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

function resultClassMeta(
  resultClass: SearchResult["resultClass"],
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  switch (resultClass) {
    case "deliverable":
      return {
        label: t("storage.results.class.deliverable"),
        style: {
          borderColor: "rgba(52, 211, 153, 0.4)",
          color: "#34D399",
        },
      };
    case "runtime-log":
      return {
        label: t("storage.results.class.runtimeLog"),
        style: {
          borderColor: "rgba(239, 68, 68, 0.35)",
          color: "var(--node-err-text)",
        },
      };
    case "raw":
      return {
        label: t("storage.results.class.raw"),
        style: {
          borderColor: "rgba(245, 158, 11, 0.35)",
          color: "#F59E0B",
        },
      };
    case "knowledge":
      return {
        label: t("storage.results.class.knowledge"),
        style: {
          borderColor: "rgba(59, 130, 246, 0.4)",
          color: "var(--node-run-text)",
        },
      };
    default:
      return {
        label: t("storage.results.class.asset"),
        style: {
          borderColor: "var(--border-color)",
          color: "var(--text-secondary)",
        },
      };
  }
}

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function ImportResultModal({
  result,
  onClose,
  onOpenPath,
  onResultChange,
}: {
  result: ImportResult | null;
  onClose: () => void;
  onOpenPath?: (path: string, options?: { reveal?: boolean }) => void;
  onResultChange: (result: ImportResult) => void;
}) {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<Record<number, { projectFolder: string; workflow: string; stage: string }>>({});
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!result) {
      setDrafts({});
      return;
    }
    const nextDrafts: Record<number, { projectFolder: string; workflow: string; stage: string }> = {};
    result.items.forEach((item, index) => {
      nextDrafts[index] = {
        projectFolder: item.projectFolder ?? "",
        workflow: item.workflow ?? "reference",
        stage: item.stage ?? "reference",
      };
    });
    setDrafts(nextDrafts);
  }, [result]);

  if (!result) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="absolute left-1/2 top-1/2 w-[min(54rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[1.5rem] border shadow-2xl"
        style={{
          background: "var(--panel-surface)",
          borderColor: "var(--border-color)",
        }}
      >
        <div
          className="flex items-start justify-between gap-4 border-b px-5 py-4"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {t("storage.modal.title")}
            </div>
            <div className="mt-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
              {result.summary}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border p-2"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderColor: "var(--border-color)",
              color: "var(--text-primary)",
            }}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpenPath?.(result.manifestPath)}
              className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
              style={{
                backgroundColor: "var(--bg-primary)",
                borderColor: "var(--border-color)",
                color: "var(--text-primary)",
              }}
            >
              {t("storage.modal.openManifest")}
            </button>
            {result.knowledgeNotePath ? (
              <button
                type="button"
                onClick={() => onOpenPath?.(result.knowledgeNotePath!)}
                className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-primary)",
                }}
              >
                {t("storage.modal.openNote")}
              </button>
            ) : null}
          </div>

          <div className="space-y-3">
            {result.items.map((item, index) => (
              <div
                key={`${item.source}-${index}`}
                className="rounded-2xl border px-4 py-4"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  borderColor: "var(--border-color)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      {item.source}
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      <input
                        value={drafts[index]?.projectFolder ?? item.projectFolder ?? ""}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [index]: {
                              projectFolder: event.target.value,
                              workflow: current[index]?.workflow ?? item.workflow ?? "reference",
                              stage: current[index]?.stage ?? item.stage ?? "reference",
                            },
                          }))
                        }
                        style={inputStyle}
                        aria-label={`${t("storage.modal.project")}${index}`}
                      />
                      <input
                        value={drafts[index]?.workflow ?? item.workflow ?? ""}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [index]: {
                              projectFolder: current[index]?.projectFolder ?? item.projectFolder ?? "",
                              workflow: event.target.value,
                              stage: current[index]?.stage ?? item.stage ?? "reference",
                            },
                          }))
                        }
                        style={inputStyle}
                        aria-label={`${t("storage.modal.workflow")}${index}`}
                      />
                      <input
                        value={drafts[index]?.stage ?? item.stage ?? ""}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [index]: {
                              projectFolder: current[index]?.projectFolder ?? item.projectFolder ?? "",
                              workflow: current[index]?.workflow ?? item.workflow ?? "reference",
                              stage: event.target.value,
                            },
                          }))
                        }
                        style={inputStyle}
                        aria-label={`${t("storage.modal.stage")}${index}`}
                      />
                    </div>
                    <div className="mt-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                      {item.projectFolder ? `${t("storage.modal.project")}${item.projectFolder} · ` : ""}
                      {item.workflow ? `${t("storage.modal.workflow")}${item.workflow} · ` : ""}
                      {item.stage ? `${t("storage.modal.stage")}${item.stage} · ` : ""}
                      {item.classifiedAs} {"->"} {item.targetBucket}
                    </div>
                    {item.matchedByMemory ? (
                      <div className="mt-2 text-[12px]" style={{ color: "#34D399" }}>
                        {t("storage.modal.memoryHit")}
                      </div>
                    ) : null}
                    {item.warning ? (
                      <div className="mt-2 text-[12px]" style={{ color: "var(--node-err-text)" }}>
                        {item.warning}
                      </div>
                    ) : null}
                  </div>
                  <span
                    className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      borderColor:
                        item.confidence === "high"
                          ? "rgba(52, 211, 153, 0.4)"
                          : item.confidence === "medium"
                            ? "rgba(59, 130, 246, 0.4)"
                            : "rgba(239, 68, 68, 0.35)",
                      color:
                        item.confidence === "high"
                          ? "#34D399"
                          : item.confidence === "medium"
                            ? "var(--node-run-text)"
                            : "var(--node-err-text)",
                    }}
                  >
                    {item.confidence}
                  </span>
                </div>
                {item.storedAt ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenPath?.(item.storedAt!)}
                      className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                      style={{
                        backgroundColor: "var(--bg-secondary)",
                        borderColor: "var(--border-color)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {t("storage.modal.openStored")}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const draft = drafts[index];
                        if (!draft) return;
                        try {
                          setSavingIndex(index);
                          const updated = await reclassifyStorageRetrievalImportItem({
                            manifestPath: result.manifestPath,
                            itemIndex: index,
                            projectFolder: draft.projectFolder,
                            workflow: draft.workflow,
                            stage: draft.stage,
                          });
                          onResultChange(updated as ImportResult);
                        } catch (error) {
                          console.error(error);
                        } finally {
                          setSavingIndex((current) => (current === index ? null : current));
                        }
                      }}
                      className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                      style={{
                        backgroundColor: "rgba(59, 130, 246, 0.12)",
                        borderColor: "var(--node-run-border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {savingIndex === index ? t("storage.modal.saving") : t("storage.modal.saveCorrection")}
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const draft = drafts[index];
                        if (!draft) return;
                        try {
                          setSavingIndex(index);
                          const updated = await reclassifyStorageRetrievalImportItem({
                            manifestPath: result.manifestPath,
                            itemIndex: index,
                            projectFolder: draft.projectFolder,
                            workflow: draft.workflow,
                            stage: draft.stage,
                          });
                          onResultChange(updated as ImportResult);
                        } catch (error) {
                          console.error(error);
                        } finally {
                          setSavingIndex((current) => (current === index ? null : current));
                        }
                      }}
                      className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                      style={{
                        backgroundColor: "rgba(59, 130, 246, 0.12)",
                        borderColor: "var(--node-run-border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {savingIndex === index ? t("storage.modal.saving") : t("storage.modal.saveCorrection")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rounded-full border px-3 py-1.5 text-[11px] font-semibold inline-flex items-center gap-2"
        style={{
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border-color)",
          color: "var(--text-primary)",
        }}
      >
        <span>{label}</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+0.5rem)] z-20 w-48 rounded-2xl border p-2"
          style={{
            background: "var(--panel-surface)",
            borderColor: "var(--border-color)",
            boxShadow: "var(--panel-shadow)",
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className="w-full rounded-xl px-3 py-2 text-left text-[12px]"
              style={{
                backgroundColor: option.value === value ? "rgba(59, 130, 246, 0.08)" : "transparent",
                color: option.value === value ? "var(--node-run-text)" : "var(--text-primary)",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const StorageRetrievalWorkspace = React.memo(function StorageRetrievalWorkspace({
  assetRoot,
  initialTab,
  recentTasks,
  targetDirectory,
  archiveRuleNote,
  onTargetDirectoryChange,
  onArchiveRuleNoteChange,
  onQueueOrganize,
  onQueueIndex,
  onQueueFullIntake,
  onOpenPath,
}: {
  assetRoot: AssetRootConfig;
  initialTab: StorageTab;
  recentTasks: AgentTask[];
  targetDirectory: string;
  archiveRuleNote: string;
  onTargetDirectoryChange: (value: string) => void;
  onArchiveRuleNoteChange: (value: string) => void;
  onQueueOrganize: () => void;
  onQueueIndex: () => void;
  onQueueFullIntake: () => void;
  onOpenPath: (path: string, options?: { reveal?: boolean }) => void;
}) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<StorageTab>(initialTab);
  const [pathEntries, setPathEntries] = useState("");
  const [linkEntries, setLinkEntries] = useState("");
  const [importNote, setImportNote] = useState("");
  const [droppedFiles, setDroppedFiles] = useState<DroppedFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>("all");
  const [searchType, setSearchType] = useState<SearchType>("all");
  const [searchPlatform, setSearchPlatform] = useState("all");
  const [searchProjectSeries, setSearchProjectSeries] = useState("");
  const [searching, setSearching] = useState(false);
  const [organizeMessage, setOrganizeMessage] = useState("");
  const [organizeError, setOrganizeError] = useState("");
  const [searchResults, setSearchResults] = useState<{ assets: SearchResult[]; knowledge: SearchResult[] }>({
    assets: [],
    knowledge: [],
  });
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentImports, setRecentImports] = useState<RecentImport[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const loadRecent = useCallback(async () => {
    try {
      setRecentLoading(true);
      const response = await fetchStorageRetrievalRecent();
      setRecentImports(response.imports);
    } catch (error) {
      console.error(error);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "recent") {
      void loadRecent();
    }
  }, [activeTab, loadRecent]);

  const handleFilesSelected = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }
    const nextFiles: DroppedFile[] = [];
    for (const file of Array.from(files)) {
      nextFiles.push({
        name: file.name,
        relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
        contentBase64: await toBase64(file),
      });
    }
    setDroppedFiles((current) => [...current, ...nextFiles]);
  }, []);

  const handleImport = useCallback(async () => {
    try {
      setImporting(true);
      const response = await importStorageRetrieval({
        pathEntries: pathEntries
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        linkEntries: linkEntries
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        note: importNote,
        files: droppedFiles,
      });
      setImportResult(response);
      setDroppedFiles([]);
      setPathEntries("");
      setLinkEntries("");
      setImportNote("");
      await loadRecent();
    } catch (error) {
      console.error(error);
    } finally {
      setImporting(false);
    }
  }, [droppedFiles, importNote, linkEntries, loadRecent, pathEntries]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults({ assets: [], knowledge: [] });
      return;
    }
    try {
      setSearching(true);
      const results = await searchStorageRetrieval({
        query: searchQuery,
        scope: searchScope,
        type: searchType,
        platform: searchPlatform,
        projectSeries: searchProjectSeries,
      });
      setSearchResults(results);
    } catch (error) {
      console.error(error);
    } finally {
      setSearching(false);
    }
  }, [searchPlatform, searchProjectSeries, searchQuery, searchScope, searchType]);

  const recentStorageTasks = useMemo(
    () =>
      recentTasks.filter((task) =>
        ["asset-organize", "asset-index"].includes(task.executionMode ?? ""),
      ),
    [recentTasks],
  );

  const handleOrganizeAction = useCallback(
    async (action: "organize" | "index" | "full") => {
      try {
        setOrganizeError("");
        const response = await queueAssetIntake({
          targetDir: targetDirectory,
          archiveRule: archiveRuleNote,
          action,
        });
        setOrganizeMessage(response.decisionSummary);
        if (action === "organize") {
          onQueueOrganize();
        } else if (action === "index") {
          onQueueIndex();
        } else {
          onQueueFullIntake();
        }
      } catch (error) {
        setOrganizeError(error instanceof Error ? error.message : "Failed to organize");
      }
    },
    [archiveRuleNote, onQueueFullIntake, onQueueIndex, onQueueOrganize, targetDirectory],
  );

  return (
    <div
      className="rounded-[1.35rem] border p-4 space-y-4"
      style={{
        background: "var(--panel-surface)",
        borderColor: "var(--border-color)",
        boxShadow: "var(--panel-shadow)",
      }}
      data-testid="storage-retrieval-workspace"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {t("storage.title")}
          </div>
          <div className="text-[12px] mt-1" style={{ color: "var(--text-secondary)" }}>
            {t("storage.subtitle")}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ["import", t("storage.tab.import"), FileUp],
            ["search", t("storage.tab.search"), Search],
            ["recent", t("storage.tab.recent"), RefreshCcw],
            ["settings", t("storage.tab.settings"), Settings2],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              data-testid={`storage-tab-${key}`}
              className="rounded-full border px-3 py-1.5 text-[11px] font-semibold inline-flex items-center gap-2"
              style={{
                backgroundColor: activeTab === key ? "rgba(59, 130, 246, 0.08)" : "var(--bg-primary)",
                borderColor: activeTab === key ? "var(--node-run-border)" : "var(--border-color)",
                color: activeTab === key ? "var(--node-run-text)" : "var(--text-primary)",
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "import" ? (
        <div className="space-y-4">
          <div
            className="rounded-[1.2rem] border p-4 space-y-4"
            style={{
              backgroundColor: "var(--panel-surface-soft)",
              borderColor: "var(--border-color)",
            }}
          >
            <div>
              <div className="text-[11px] font-semibold" style={sectionTitleStyle}>
                {t("storage.import.putIn")}
              </div>
              <div className="mt-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                {t("storage.import.putInHint")}
              </div>
            </div>

            <div
              className="rounded-[1rem] border border-dashed px-4 py-6 text-center"
              style={{
                borderColor: "var(--border-hover)",
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-secondary)",
              }}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={async (event) => {
                event.preventDefault();
                await handleFilesSelected(event.dataTransfer.files);
              }}
            >
              <FolderInput className="mx-auto h-5 w-5" />
              <div className="mt-2 text-[12px]">{t("storage.import.dropzone")}</div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-primary)",
                }}
              >
                {t("storage.import.chooseFiles")}
              </button>
              <input
                ref={fileInputRef}
                hidden
                type="file"
                multiple
                onChange={(event) => void handleFilesSelected(event.target.files)}
              />
            </div>

            {droppedFiles.length > 0 ? (
              <div className="rounded-[1rem] border px-4 py-3" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-primary)" }}>
                <div className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {t("storage.import.selectedFiles", { count: droppedFiles.length })}
                </div>
                <div className="mt-2 space-y-1">
                  {droppedFiles.slice(0, 6).map((file) => (
                    <div key={file.relativePath} className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {file.relativePath}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <label className="block space-y-2">
              <span style={sectionTitleStyle}>{t("storage.import.paths")}</span>
              <textarea
                value={pathEntries}
                onChange={(event) => setPathEntries(event.target.value)}
                rows={4}
                style={{ ...inputStyle, resize: "vertical" }}
                placeholder={t("storage.import.pathsPlaceholder")}
              />
            </label>
            <label className="block space-y-2">
              <span style={sectionTitleStyle}>{t("storage.import.links")}</span>
              <textarea
                value={linkEntries}
                onChange={(event) => setLinkEntries(event.target.value)}
                rows={4}
                style={{ ...inputStyle, resize: "vertical" }}
                placeholder={t("storage.import.linksPlaceholder")}
              />
            </label>
            <label className="block space-y-2">
              <span style={sectionTitleStyle}>{t("storage.import.note")}</span>
              <textarea
                value={importNote}
                onChange={(event) => setImportNote(event.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
                placeholder={t("storage.import.notePlaceholder")}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={importing}
                className="rounded-full border px-4 py-2 text-[12px] font-semibold"
                style={{
                  backgroundColor: "rgba(59, 130, 246, 0.12)",
                  borderColor: "var(--node-run-border)",
                  color: "var(--text-primary)",
                }}
              >
                {importing ? t("storage.import.importing") : t("storage.import.submit")}
              </button>
            </div>
          </div>

          <div
            id="asset-intake-panel"
            className="rounded-[1.2rem] border p-4 space-y-4"
            style={{
              backgroundColor: "var(--panel-surface-soft)",
              borderColor: "var(--border-color)",
            }}
            data-testid="asset-intake-panel"
          >
            <div>
              <div className="text-[11px] font-semibold" style={sectionTitleStyle}>
                {t("storage.organize.title")}
              </div>
              <div className="mt-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                {t("storage.organize.subtitle")}
              </div>
            </div>
            <div className="space-y-2">
              <label className="block space-y-2">
                <span style={sectionTitleStyle}>{t("assetIntake.targetDirectory")}</span>
                <input
                  aria-label={t("assetIntake.targetDirectory")}
                  value={targetDirectory}
                  style={inputStyle}
                  onChange={(event) => onTargetDirectoryChange(event.target.value)}
                />
              </label>
              <label className="block space-y-2">
                <span style={sectionTitleStyle}>{t("storage.organize.note")}</span>
                <input
                  aria-label={t("assetIntake.archiveRule")}
                  value={archiveRuleNote}
                  style={inputStyle}
                  placeholder={t("storage.organize.notePlaceholder")}
                  onChange={(event) => onArchiveRuleNoteChange(event.target.value)}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ["organize", t("assetIntake.step.organize.button")],
                ["index", t("assetIntake.step.index.button")],
                ["full", t("assetIntake.queue.full")],
              ] as const).map(([action, label]) => (
                <button
                  key={action}
                  type="button"
                  className="rounded-full border px-4 py-2 text-[12px] font-semibold"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                  onClick={() => void handleOrganizeAction(action)}
                >
                  {label}
                </button>
              ))}
            </div>
            {organizeMessage ? (
              <div className="text-[12px]" style={{ color: "var(--node-run-text)" }}>
                {t("storage.organize.lastAction", { message: organizeMessage })}
              </div>
            ) : null}
            {organizeError ? (
              <div className="text-[12px]" style={{ color: "var(--node-err-text)" }}>
                {organizeError}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeTab === "search" ? (
        <div id="evidence-search-panel" data-testid="evidence-search-panel" className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("storage.search.placeholder")}
                style={inputStyle}
                aria-label={t("evidence.search.label")}
              />
              <button
                type="button"
                onClick={() => void handleSearch()}
                className="rounded-2xl border px-4 py-2 text-sm font-semibold"
                style={{
                  borderColor: "var(--node-run-border)",
                  background: "linear-gradient(180deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.05))",
                  color: "var(--node-run-text)",
                }}
              >
                {searching ? t("evidence.search.searching") : t("evidence.search.submit")}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterDropdown<SearchScope>
                label={t(`storage.filter.scope.${searchScope}`)}
                value={searchScope}
                options={[
                  { label: t("storage.filter.scope.all"), value: "all" },
                  { label: t("storage.filter.scope.assets"), value: "assets" },
                  { label: t("storage.filter.scope.knowledge"), value: "knowledge" },
                ]}
                onChange={(value) => setSearchScope(value)}
              />
              <FilterDropdown<SearchType>
                label={t(`storage.filter.type.${searchType}`)}
                value={searchType}
                options={[
                  { label: t("storage.filter.type.all"), value: "all" },
                  { label: t("storage.filter.type.image"), value: "image" },
                  { label: t("storage.filter.type.video"), value: "video" },
                  { label: t("storage.filter.type.document"), value: "document" },
                  { label: t("storage.filter.type.knowledge"), value: "knowledge" },
                  { label: t("storage.filter.type.directory"), value: "directory" },
                  { label: t("storage.filter.type.data"), value: "data" },
                ]}
                onChange={(value) => setSearchType(value)}
              />
              <FilterDropdown
                label={searchPlatform === "all" ? t("storage.filter.platform.all") : searchPlatform}
                value={searchPlatform}
                options={[
                  { label: t("storage.filter.platform.all"), value: "all" },
                  { label: "douyin", value: "douyin" },
                  { label: "xiaohongshu", value: "xiaohongshu" },
                  { label: "mission-control", value: "mission-control" },
                ]}
                onChange={setSearchPlatform}
              />
              <input
                value={searchProjectSeries}
                onChange={(event) => setSearchProjectSeries(event.target.value)}
                placeholder={t("storage.search.projectPlaceholder")}
                className="rounded-full border px-3 py-1.5 text-[11px]"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          {([
            ["assets", searchResults.assets],
            ["knowledge", searchResults.knowledge],
          ] as const).map(([group, items]) => (
            <div
              key={group}
              className="rounded-[1.2rem] border p-4 space-y-3"
              style={{
                backgroundColor: "var(--panel-surface-soft)",
                borderColor: "var(--border-color)",
              }}
            >
              <div className="text-[11px] font-semibold" style={sectionTitleStyle}>
                {group === "knowledge" ? t("storage.results.knowledge") : t("storage.results.assets")}
              </div>
              {items.length === 0 ? (
                <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                  {t("storage.results.empty")}
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border px-4 py-4"
                      style={{
                        backgroundColor: "var(--bg-primary)",
                        borderColor: "var(--border-color)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                              {item.title}
                            </div>
                            <span
                              className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase"
                              style={{
                                backgroundColor: "var(--bg-secondary)",
                                ...resultClassMeta(item.resultClass, t).style,
                              }}
                            >
                              {resultClassMeta(item.resultClass, t).label}
                            </span>
                          </div>
                          <div className="mt-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                            {item.summary || item.path}
                          </div>
                          <div className="mt-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                            {item.projectSeries ? `${item.projectSeries} · ` : ""}{item.platform ? `${item.platform} · ` : ""}{item.path}
                          </div>
                        </div>
                        {item.updatedAt ? (
                          <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                            {item.updatedAt}
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenPath(item.path)}
                          className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                          style={{
                            backgroundColor: "var(--bg-secondary)",
                            borderColor: "var(--border-color)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {t("storage.results.open")}
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenPath(item.path, { reveal: true })}
                          className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                          style={{
                            backgroundColor: "var(--bg-secondary)",
                            borderColor: "var(--border-color)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {t("storage.results.reveal")}
                        </button>
                        {item.linkedKnowledgePath ? (
                          <button
                            type="button"
                            onClick={() => onOpenPath(item.linkedKnowledgePath!)}
                            className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                            style={{
                              backgroundColor: "var(--bg-secondary)",
                              borderColor: "var(--border-color)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {t("storage.results.openRecord")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === "recent" ? (
        <div className="space-y-4">
          <div
            className="rounded-[1.2rem] border p-4 space-y-3"
            style={{
              backgroundColor: "var(--panel-surface-soft)",
              borderColor: "var(--border-color)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold" style={sectionTitleStyle}>
                {t("storage.recent.imports")}
              </div>
              <button
                type="button"
                onClick={() => void loadRecent()}
                className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-primary)",
                }}
              >
                {t("storage.recent.refresh")}
              </button>
            </div>
            {recentLoading ? (
              <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                {t("storage.recent.loading")}
              </div>
            ) : recentImports.length === 0 ? (
              <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                {t("storage.recent.empty")}
              </div>
            ) : (
              <div className="space-y-3">
                {recentImports.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border px-4 py-4"
                    style={{
                      backgroundColor: "var(--bg-primary)",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                      {item.summary}
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {item.importedAt}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenPath(item.manifestPath)}
                        className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                        style={{
                          backgroundColor: "var(--bg-secondary)",
                          borderColor: "var(--border-color)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {t("storage.modal.openManifest")}
                      </button>
                      {item.knowledgeNotePath ? (
                        <button
                          type="button"
                          onClick={() => onOpenPath(item.knowledgeNotePath!)}
                          className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                          style={{
                            backgroundColor: "var(--bg-secondary)",
                            borderColor: "var(--border-color)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {t("storage.modal.openNote")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className="rounded-[1.2rem] border p-4 space-y-3"
            style={{
              backgroundColor: "var(--panel-surface-soft)",
              borderColor: "var(--border-color)",
            }}
          >
            <div className="text-[11px] font-semibold" style={sectionTitleStyle}>
              {t("storage.recent.tasks")}
            </div>
            {recentStorageTasks.length === 0 ? (
              <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                {t("storage.recent.empty")}
              </div>
            ) : (
              recentStorageTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-2xl border px-4 py-4"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    borderColor: "var(--border-color)",
                  }}
                >
                  <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {task.nodeLabel}
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {task.resultSummary || task.command}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {activeTab === "settings" ? (
        <div className="space-y-4">
          <div
            className="rounded-[1.2rem] border p-4 space-y-3"
            style={{
              backgroundColor: "var(--panel-surface-soft)",
              borderColor: "var(--border-color)",
            }}
          >
            <div className="text-[11px] font-semibold" style={sectionTitleStyle}>
              {t("storage.settings.root")}
            </div>
            <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              {assetRoot.path}
            </div>
            <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
              {assetRoot.configured ? t("assetIntake.description.configured") : t("assetIntake.description.suggested")}
            </div>
          </div>

          <div
            className="rounded-[1.2rem] border p-4 space-y-3"
            style={{
              backgroundColor: "var(--panel-surface-soft)",
              borderColor: "var(--border-color)",
            }}
          >
            <div className="text-[11px] font-semibold" style={sectionTitleStyle}>
              {t("storage.settings.naming")}
            </div>
            <div className="space-y-2">
              {assetRoot.namingContract.summary.map((line) => (
                <div key={line} className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <ImportResultModal
        result={importResult}
        onClose={() => setImportResult(null)}
        onOpenPath={onOpenPath}
        onResultChange={setImportResult}
      />
    </div>
  );
});
