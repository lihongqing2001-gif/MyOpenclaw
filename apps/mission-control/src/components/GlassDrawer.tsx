import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Play,
  Settings2,
  BookOpen,
  Fingerprint,
  Database,
  Link as LinkIcon,
  Hash,
  Search,
  Loader2,
  Package2,
  ExternalLink,
  ShieldCheck,
  Download,
} from "lucide-react";
import { SkillModule, SkillNode, KnowledgeItem, PortableBundleExport } from "../types";
import { executeNode, exportPortableBundle, searchKnowledge } from "../services/api";

interface GlassDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  node: SkillNode | null;
}

const sourceTypeLabel: Record<string, string> = {
  skill: "Installed Skill",
  foundation: "Foundation Module",
  integration: "External Integration",
  sop: "Workflow Asset",
};

const SkillModuleCard = ({
  module,
  onSelect,
}: {
  module: SkillModule;
  onSelect: (module: SkillModule) => void;
}) => (
  <button
    type="button"
    onClick={() => onSelect(module)}
    className="w-full rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm"
    style={{
      backgroundColor: "var(--bg-primary)",
      borderColor: module.installed
        ? "var(--border-color)"
        : "var(--node-err-border)",
    }}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div
          className="text-xs font-semibold truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {module.label}
        </div>
        <div
          className="text-[10px] mt-1"
          style={{ color: "var(--text-secondary)" }}
        >
          {sourceTypeLabel[module.sourceType] ?? "Module"}
        </div>
      </div>
      <span
        className="shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold border"
        style={{
          borderColor: module.installed
            ? "var(--border-color)"
            : "var(--node-err-border)",
          color: module.installed
            ? "var(--text-secondary)"
            : "var(--node-err-text)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        {module.installed ? "INSTALLED" : "REQUIRED"}
      </span>
    </div>
    {module.evidence && (
      <div
        className="mt-2 inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold"
        style={{
          borderColor: "var(--border-color)",
          backgroundColor: "var(--bg-secondary)",
          color: "var(--text-secondary)",
        }}
      >
        {module.evidence.toUpperCase()}
      </div>
    )}
    <p
      className="mt-3 text-[11px] leading-relaxed line-clamp-3"
      style={{ color: "var(--text-secondary)" }}
    >
      {module.summary}
    </p>
  </button>
);

export const GlassDrawer = ({ isOpen, onClose, node }: GlassDrawerProps) => {
  const [activeTab, setActiveTab] = useState<"overview" | "knowledge">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeItem | null>(null);
  const [selectedModule, setSelectedModule] = useState<SkillModule | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [isExportingBundle, setIsExportingBundle] = useState(false);
  const [drawerFeedback, setDrawerFeedback] = useState<string | null>(null);
  const [bundleExport, setBundleExport] = useState<PortableBundleExport | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setDrawerFeedback(`Searching knowledge base for "${searchQuery.trim()}"…`);
    try {
      const { results } = await searchKnowledge(searchQuery);
      setSearchResults(results);
      setSelectedKnowledge(null);
      setDrawerFeedback(
        results.length > 0
          ? `Found ${results.length} knowledge item${results.length === 1 ? "" : "s"} for "${searchQuery.trim()}".`
          : `No knowledge matches for "${searchQuery.trim()}".`,
      );
    } catch (error) {
      console.error("Search failed", error);
      setDrawerFeedback("Knowledge search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectKnowledge = (result: KnowledgeItem) => {
    setSelectedKnowledge(result);
    setDrawerFeedback(`Selected knowledge item: ${result.human.title}.`);
  };

  const handleRunWorkflow = async (item: KnowledgeItem) => {
    if (!node) return;

    const command = item.machine.commands[0] || "";
    const requiredSkills = node.drawerContent?.requiredSkills ?? [];

    try {
      setIsExecuting(true);
      setDrawerFeedback(`Queueing "${item.human.title}" workflow…`);
      const response = await executeNode(node.id, command, {
        inputValues,
        sourcePath: node.sourcePath,
        sourceType: node.sourceType,
        inputSchema: node.drawerContent?.inputs ?? [],
        route: node.drawerContent?.route,
        requiredSkills,
      });
      setDrawerFeedback(`Queued for agent: ${response.task.nodeLabel}`);
    } catch (error) {
      console.error("Execution failed", error);
      setDrawerFeedback(`Failed to queue workflow: ${command}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExecuteNode = async () => {
    if (!node || !node.drawerContent) return;

    const command =
      node.drawerContent.invoke ||
      node.drawerContent.commands?.[0] ||
      `__OPENCLAW_WORKFLOW__ ${node.id}`;
    const requiredSkills = node.drawerContent.requiredSkills ?? [];

    try {
      setIsExecuting(true);
      setDrawerFeedback("Queueing SOP execution…");
      const response = await executeNode(node.id, command, {
        inputValues,
        sourcePath: node.sourcePath,
        sourceType: node.sourceType,
        inputSchema: node.drawerContent.inputs,
        route: node.drawerContent.route,
        requiredSkills,
      });
      setDrawerFeedback(`Queued for agent: ${response.task.nodeLabel}`);
    } catch (error) {
      console.error("Execution failed", error);
      setDrawerFeedback(`Failed to queue node: ${command}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExportBundle = async () => {
    if (!node || node.level !== 3) return;

    try {
      setIsExportingBundle(true);
      const response = await exportPortableBundle(node.id);
      setBundleExport(response.bundle);
      setDrawerFeedback(`Portable bundle ready: ${response.bundle.nodeLabel}`);
    } catch (error) {
      console.error("Bundle export failed", error);
      setDrawerFeedback(
        error instanceof Error ? error.message : "Failed to export portable bundle",
      );
    } finally {
      setIsExportingBundle(false);
    }
  };

  React.useEffect(() => {
    if (!isOpen) {
      setActiveTab("overview");
      setSearchQuery("");
      setSearchResults([]);
      setSelectedKnowledge(null);
      setSelectedModule(null);
      setDrawerFeedback(null);
      setBundleExport(null);
      setIsExecuting(false);
      setIsExportingBundle(false);
      setInputValues({});
    }
  }, [isOpen, node]);

  React.useEffect(() => {
    if (!node?.drawerContent) {
      return;
    }

    const defaults: Record<string, string> = {};
    node.drawerContent.inputs.forEach((input) => {
      defaults[input.field] = input.defaultValue ?? "";
    });
    setInputValues(defaults);
  }, [node]);

  if (!node || !node.drawerContent) return null;

  const { label, status, drawerContent } = node;
  const requiredSkills = drawerContent.requiredSkills ?? [];
  const canExecute = node.level === 3;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/20"
          />

          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed top-0 right-0 bottom-0 w-[28rem] z-50 flex flex-col border-l shadow-2xl"
            style={{
              backgroundColor: "var(--bg-drawer)",
              borderColor: "var(--border-color)",
            }}
          >
            <div
              className="flex flex-col border-b"
              style={{ borderColor: "var(--border-color)" }}
            >
              <div className="flex items-center justify-between p-6 pb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="p-2 rounded-lg border shadow-sm"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    <Fingerprint
                      className="w-4 h-4"
                      style={{ color: "var(--node-run-text)" }}
                    />
                  </div>
                  <div className="min-w-0">
                    <h2
                      className="text-sm font-semibold text-wrap-safe"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {label}
                    </h2>
                    <div
                      className="flex items-center gap-2 text-[10px] mt-1 font-medium"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <span className="flex items-center gap-1">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor:
                              status === "running"
                                ? "var(--node-run-text)"
                                : status === "error"
                                  ? "var(--node-err-text)"
                                  : "var(--text-secondary)",
                          }}
                        />
                        {status.toUpperCase()}
                      </span>
                      <span>{node.level === 1 ? "DOMAIN" : node.level === 2 ? "AREA" : "SOP"}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div
                className="flex px-6 gap-4"
                role="tablist"
                aria-label="Drawer tabs"
              >
                <button
                  onClick={() => setActiveTab("overview")}
                  role="tab"
                  id="drawer-tab-overview"
                  aria-controls="drawer-tabpanel-overview"
                  aria-selected={activeTab === "overview"}
                  data-testid="drawer-tab-overview"
                  className={`pb-3 text-xs font-medium transition-colors relative ${activeTab === "overview" ? "" : "opacity-50 hover:opacity-100"}`}
                  style={{
                    color:
                      activeTab === "overview"
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                  }}
                >
                  Overview
                  {activeTab === "overview" && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ backgroundColor: "var(--text-primary)" }}
                    />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("knowledge")}
                  role="tab"
                  id="drawer-tab-knowledge"
                  aria-controls="drawer-tabpanel-knowledge"
                  aria-selected={activeTab === "knowledge"}
                  data-testid="drawer-tab-knowledge"
                  className={`pb-3 text-xs font-medium transition-colors relative ${activeTab === "knowledge" ? "" : "opacity-50 hover:opacity-100"}`}
                  style={{
                    color:
                      activeTab === "knowledge"
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                  }}
                >
                  Knowledge Search
                  {activeTab === "knowledge" && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ backgroundColor: "var(--text-primary)" }}
                    />
                  )}
                </button>
              </div>
            </div>

            <div className="p-6 space-y-8 flex-1 overflow-y-auto">
              {activeTab === "overview" ? (
                <>
                  {(drawerContent.summary ||
                    drawerContent.prerequisites ||
                    node.sourcePath ||
                    drawerContent.minimumSkillsNote) && (
                    <section>
                      <h3
                        className="flex items-center gap-2 text-xs font-semibold mb-3 uppercase tracking-wider"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Fingerprint
                          className="w-3.5 h-3.5"
                          style={{ color: "var(--node-run-text)" }}
                        />
                        Context
                      </h3>
                      <div className="space-y-3 pr-2">
                        {drawerContent.summary && (
                          <div
                            className="text-xs leading-relaxed"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {drawerContent.summary}
                          </div>
                        )}
                        {drawerContent.minimumSkillsNote && (
                          <div
                            className="rounded-xl border px-3 py-2 text-[11px]"
                            style={{
                              backgroundColor: "var(--bg-primary)",
                              borderColor: "var(--border-color)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {drawerContent.minimumSkillsNote}
                          </div>
                        )}
                        {drawerContent.prerequisites && (
                          <div
                            className="text-[11px] leading-relaxed"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            Preconditions: {drawerContent.prerequisites}
                          </div>
                        )}
                        {node.sourcePath && (
                          <div
                            className="text-[10px] break-all"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            Source: {node.sourcePath}
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  <section>
                    <h3
                      className="flex items-center gap-2 text-xs font-semibold mb-3 uppercase tracking-wider"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <Package2
                        className="w-3.5 h-3.5"
                        style={{ color: "var(--node-run-text)" }}
                      />
                      Required Skill Modules
                    </h3>
                    {requiredSkills.length > 0 ? (
                      <div className="space-y-3 pr-2">
                        {requiredSkills.map((module) => (
                          <div key={module.id}>
                            <SkillModuleCard
                              module={module}
                              onSelect={setSelectedModule}
                            />
                          </div>
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
                        This layer has no explicit skill dependency metadata yet.
                      </div>
                    )}
                  </section>

                  {drawerContent.route && (
                    <section>
                      <h3
                        className="flex items-center gap-2 text-xs font-semibold mb-3 uppercase tracking-wider"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Fingerprint
                          className="w-3.5 h-3.5"
                          style={{ color: "var(--node-run-text)" }}
                        />
                        Agent Routing
                      </h3>
                      <div
                        className="rounded-xl border px-3 py-3 space-y-3 text-[11px]"
                        style={{
                          backgroundColor: "var(--bg-primary)",
                          borderColor: "var(--border-color)",
                        }}
                      >
                        <div>
                          <div
                            className="text-[10px] uppercase tracking-wider"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            Orchestrator
                          </div>
                          <div
                            className="mt-1 font-semibold"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {drawerContent.route.orchestrator}
                          </div>
                        </div>

                        <div>
                          <div
                            className="text-[10px] uppercase tracking-wider"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            Preferred Agents
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {drawerContent.route.preferredAgents.map((agent) => (
                              <span
                                key={agent}
                                className="rounded-full border px-2 py-1 text-[10px] font-medium"
                                style={{
                                  backgroundColor: "var(--bg-secondary)",
                                  borderColor: "var(--border-color)",
                                  color: "var(--text-primary)",
                                }}
                              >
                                {agent}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div
                          className="leading-relaxed"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {drawerContent.route.reason}
                        </div>
                      </div>
                    </section>
                  )}

                  {canExecute && (
                    <section>
                      <h3
                        className="flex items-center gap-2 text-xs font-semibold mb-3 uppercase tracking-wider"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Download
                          className="w-3.5 h-3.5"
                          style={{ color: "var(--node-run-text)" }}
                        />
                        Portable Bundle
                      </h3>
                      <div
                        className="rounded-xl border px-3 py-3 text-[11px] leading-relaxed"
                        style={{
                          backgroundColor: "var(--bg-primary)",
                          borderColor: "var(--border-color)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        导出后会生成一个可移植 zip，包含 SOP、可打包的本地技能、知识文档、安装器与健康检查脚本。
                        {bundleExport && (
                          <div
                            className="mt-3 rounded-lg border px-3 py-3"
                            style={{
                              backgroundColor: "var(--bg-secondary)",
                              borderColor: "var(--border-color)",
                            }}
                          >
                            <div
                              className="text-[11px] font-semibold"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {bundleExport.capabilityId}
                            </div>
                            <div
                              className="mt-1 text-[10px]"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {bundleExport.dependencies.length > 0
                                ? `External dependencies: ${bundleExport.dependencies.length}`
                                : "No external dependencies declared"}
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {drawerContent.capabilities.length > 0 && (
                    <section>
                      <h3
                        className="flex items-center gap-2 text-xs font-semibold mb-3 uppercase tracking-wider"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Settings2
                          className="w-3.5 h-3.5"
                          style={{ color: "var(--node-run-text)" }}
                        />
                        Capabilities
                      </h3>
                      <ul className="space-y-2 pr-2">
                        {drawerContent.capabilities.map((cap, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-xs text-wrap-safe"
                            style={{ color: "var(--text-primary)" }}
                          >
                            <div
                              className="w-1 h-1 rounded-full mt-1.5 shrink-0"
                              style={{ backgroundColor: "var(--text-secondary)" }}
                            />
                            <span>{cap}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {drawerContent.inputs.length > 0 && (
                    <section>
                      <h3
                        className="flex items-center gap-2 text-xs font-semibold mb-3 uppercase tracking-wider"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Settings2
                          className="w-3.5 h-3.5"
                          style={{ color: "var(--node-run-text)" }}
                        />
                        Inputs
                      </h3>
                      <div className="space-y-4 pr-2">
                        {drawerContent.inputs.map((input, idx) => (
                          <div key={idx} className="space-y-1.5">
                            <label
                              className="text-[11px] font-medium"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {input.field}
                            </label>
                            {input.type === "text" ? (
                              <input
                                type="text"
                                value={inputValues[input.field] ?? ""}
                                onChange={(event) =>
                                  setInputValues((current) => ({
                                    ...current,
                                    [input.field]: event.target.value,
                                  }))
                                }
                                placeholder={
                                  input.placeholder ??
                                  `Enter ${input.field.toLowerCase()}...`
                                }
                                className="w-full border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all shadow-sm"
                                style={{
                                  backgroundColor: "var(--bg-primary)",
                                  borderColor: "var(--border-color)",
                                  color: "var(--text-primary)",
                                }}
                              />
                            ) : (
                              <input type="range" className="w-full accent-blue-500" />
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {drawerContent.knowledgeBase && (
                    <section>
                      <h3
                        className="flex items-center gap-2 text-xs font-semibold mb-3 uppercase tracking-wider"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Database
                          className="w-3.5 h-3.5"
                          style={{ color: "var(--node-run-text)" }}
                        />
                        Knowledge Base
                      </h3>
                      <div className="space-y-3 pr-2">
                        {drawerContent.knowledgeBase.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {drawerContent.knowledgeBase.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border"
                                style={{
                                  backgroundColor: "var(--bg-secondary)",
                                  borderColor: "var(--border-color)",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                <Hash className="w-3 h-3" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {drawerContent.knowledgeBase.documents.map((doc, idx) => (
                          <a
                            key={idx}
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2.5 rounded-md border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                            style={{
                              backgroundColor: "var(--bg-primary)",
                              borderColor: "var(--border-color)",
                            }}
                          >
                            <LinkIcon
                              className="w-3.5 h-3.5 shrink-0"
                              style={{ color: "var(--text-secondary)" }}
                            />
                            <span
                              className="text-xs font-medium truncate"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {doc.title}
                            </span>
                          </a>
                        ))}
                      </div>
                    </section>
                  )}

                  {drawerContent.useCases.length > 0 && (
                    <section>
                      <h3
                        className="flex items-center gap-2 text-xs font-semibold mb-3 uppercase tracking-wider"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <BookOpen
                          className="w-3.5 h-3.5"
                          style={{ color: "var(--node-run-text)" }}
                        />
                        SOP Coverage
                      </h3>
                      <div className="space-y-3 pr-2">
                        {drawerContent.useCases.map((useCase, idx) => (
                          <motion.div
                            key={idx}
                            whileHover={{ scale: 1.01 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            className="p-3 rounded-md border shadow-sm hover:shadow"
                            style={{
                              backgroundColor: "var(--bg-primary)",
                              borderColor: "var(--border-color)",
                            }}
                          >
                            <h4
                              className="text-xs font-medium mb-1 text-wrap-safe"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {useCase.title}
                            </h4>
                            <p
                              className="text-[11px] leading-relaxed text-wrap-safe"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {useCase.summary}
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <div className="space-y-6">
                  <form onSubmit={handleSearch} className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                      style={{ color: "var(--text-secondary)" }}
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search knowledge base..."
                      className="w-full border rounded-md pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all shadow-sm"
                      style={{
                        backgroundColor: "var(--bg-primary)",
                        borderColor: "var(--border-color)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </form>

                  {isSearching ? (
                    <div className="flex justify-center py-8">
                      <Loader2
                        className="w-5 h-5 animate-spin"
                        style={{ color: "var(--text-secondary)" }}
                      />
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-3">
                      {searchResults.map((result) => (
                        <motion.div
                          key={result.id}
                          whileHover={{ scale: 1.01 }}
                          onClick={() => setSelectedKnowledge(result)}
                          className={`p-3 rounded-md border cursor-pointer shadow-sm transition-colors ${selectedKnowledge?.id === result.id ? "ring-1 ring-blue-500" : "hover:shadow"}`}
                          style={{
                            backgroundColor: "var(--bg-primary)",
                            borderColor:
                              selectedKnowledge?.id === result.id
                                ? "transparent"
                                : "var(--border-color)",
                          }}
                        >
                          <h4
                            className="text-xs font-medium mb-1 text-wrap-safe"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {result.human.title}
                          </h4>
                          <p
                            className="text-[11px] leading-relaxed text-wrap-safe mb-2"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {result.human.summary}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {result.human.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded text-[9px] font-medium border"
                                style={{
                                  backgroundColor: "var(--bg-secondary)",
                                  borderColor: "var(--border-color)",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : searchQuery && !isSearching ? (
                    <div
                      className="text-center py-8 text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      No results found for "{searchQuery}"
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div
              className="p-4 border-t"
              style={{
                borderColor: "var(--border-color)",
                backgroundColor: "var(--bg-secondary)",
              }}
            >
              {drawerFeedback && (
                <div
                  className="mb-3 rounded-md border px-3 py-2 text-[11px]"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-secondary)",
                  }}
                  role="status"
                  aria-live="polite"
                  data-testid="drawer-feedback"
                >
                  {drawerFeedback}
                </div>
              )}

              {bundleExport && (
                <div
                  className="mb-3 rounded-xl border px-3 py-3"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    borderColor: "var(--border-color)",
                  }}
                >
                  <div
                    className="text-[11px] font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {bundleExport.capabilityId}
                  </div>
                  <div
                    className="mt-1 text-[10px] break-all"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {bundleExport.relativeZipPath}
                  </div>
                  <a
                    href={bundleExport.downloadUrl}
                    download
                    className="mt-3 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[11px] font-medium"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      borderColor: "var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Bundle Zip
                  </a>
                </div>
              )}

              {activeTab === "knowledge" && selectedKnowledge ? (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleRunWorkflow(selectedKnowledge)}
                  disabled={isExecuting}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-colors border shadow-sm"
                  style={{
                    backgroundColor: "var(--node-run-text)",
                    color: "#fff",
                    borderColor: "var(--node-run-border)",
                  }}
                >
                  {isExecuting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  {isExecuting ? "Queueing Workflow..." : "Run Workflow"}
                </motion.button>
              ) : canExecute ? (
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleExportBundle}
                    disabled={isExportingBundle}
                    className="flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-colors border shadow-sm"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      color: "var(--text-primary)",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    {isExportingBundle ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    {isExportingBundle ? "Exporting..." : "Export Bundle"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleExecuteNode}
                    disabled={isExecuting}
                    className="flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-colors border shadow-sm"
                    style={{
                      backgroundColor: "var(--bg-primary)",
                      color: "var(--text-primary)",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    {isExecuting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    {isExecuting ? "Queueing SOP..." : "Execute SOP"}
                  </motion.button>
                </div>
              ) : (
                <div
                  className="rounded-xl border px-3 py-2 text-[11px] flex items-center gap-2"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Domain 和 Area 只做说明与依赖聚合，不直接执行。
                </div>
              )}
            </div>
          </motion.div>

          <AnimatePresence>
            {selectedModule && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] bg-black/30"
                  onClick={() => setSelectedModule(null)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 320, damping: 30 }}
                  className="fixed z-[61] top-1/2 left-1/2 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border shadow-2xl"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderColor: "var(--border-color)",
                  }}
                >
                  <div
                    className="flex items-center justify-between px-5 py-4 border-b"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <div>
                      <div
                        className="text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {selectedModule.label}
                      </div>
                      <div
                        className="text-[10px] mt-1"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {sourceTypeLabel[selectedModule.sourceType] ?? "Module"}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedModule(null)}
                      className="p-1.5 rounded-md"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="px-5 py-5 space-y-5">
                    <div
                      className="rounded-xl border px-3 py-3 text-[11px]"
                      style={{
                        backgroundColor: "var(--bg-primary)",
                        borderColor: selectedModule.installed
                          ? "var(--border-color)"
                          : "var(--node-err-border)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {selectedModule.installed
                        ? "当前工作区已检测到该技能模块。"
                        : "当前层级运行需要该技能模块，尚未检测到安装状态。"}
                    </div>

                    <div
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {selectedModule.summary}
                    </div>

                    {selectedModule.capabilities && selectedModule.capabilities.length > 0 && (
                      <div className="space-y-2">
                        <div
                          className="text-[11px] font-semibold uppercase tracking-wider"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Module Capabilities
                        </div>
                        <div className="space-y-2">
                          {selectedModule.capabilities.map((item, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg border px-3 py-2 text-[11px]"
                              style={{
                                backgroundColor: "var(--bg-primary)",
                                borderColor: "var(--border-color)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {selectedModule.installCommand && (
                        <div
                          className="rounded-xl border px-3 py-3"
                          style={{
                            backgroundColor: "var(--bg-primary)",
                            borderColor: "var(--border-color)",
                          }}
                        >
                          <div
                            className="text-[10px] uppercase tracking-wider mb-2"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            Install / Setup
                          </div>
                          <code
                            className="block text-[11px] leading-relaxed whitespace-pre-wrap"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {selectedModule.installCommand}
                          </code>
                        </div>
                      )}

                      {selectedModule.installUrl && (
                        <a
                          href={selectedModule.installUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between rounded-xl border px-3 py-3 text-sm"
                          style={{
                            backgroundColor: "var(--bg-primary)",
                            borderColor: "var(--border-color)",
                            color: "var(--text-primary)",
                          }}
                        >
                          <span>Open download / documentation link</span>
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}

                      {selectedModule.sourcePath && (
                        <div
                          className="text-[10px] break-all"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Source: {selectedModule.sourcePath}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
};
