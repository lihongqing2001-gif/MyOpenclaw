import React, { useCallback, useDeferredValue, useEffect, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Edge,
  Node,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Search } from "lucide-react";
import { SkillNodeComponent } from "./SkillNodeComponent";
import { GlassDrawer } from "./GlassDrawer";
import { mockSkillNodes } from "../data/mockData";
import { generateFlowElements, getLayoutedElements } from "../utils/layout";
import { fetchSkillTree, subscribeToStream } from "../services/api";
import { SkillNode } from "../types";
import { useI18n } from "../i18n";

const nodeTypes = {
  skillNode: SkillNodeComponent,
};

type FlowNode = Node<Record<string, unknown> & SkillNode & { isExpanded?: boolean }>;

const recalculateTreeVisibility = (nodes: FlowNode[], edges: Edge[]) => {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const nextNodes = nodes.map((node) => {
    const data = node.data as SkillNode & { isExpanded?: boolean };
    let hidden = false;

    if (data.level === 2 && data.parentId) {
      const parent = nodeMap.get(data.parentId);
      hidden = !(parent?.data as { isExpanded?: boolean } | undefined)?.isExpanded;
    }

    if (data.level === 3 && data.parentId) {
      const areaNode = nodeMap.get(data.parentId);
      const areaVisible = !areaNode?.hidden;
      const areaExpanded = (areaNode?.data as { isExpanded?: boolean } | undefined)?.isExpanded;
      hidden = !areaVisible || !areaExpanded;
    }

    return {
      ...node,
      hidden,
    };
  });

  const hiddenById = new Map(nextNodes.map((node) => [node.id, node.hidden]));
  const nextNodesWithLeaves = nextNodes.map((node) => {
    const data = node.data as SkillNode & { isExpanded?: boolean };
    if (data.level !== 3 || !data.parentId) {
      return node;
    }

    const areaNode = nextNodes.find((candidate) => candidate.id === data.parentId);
    const areaVisible = !hiddenById.get(data.parentId);
    const areaExpanded = (areaNode?.data as { isExpanded?: boolean } | undefined)?.isExpanded;

    return {
      ...node,
      hidden: !areaVisible || !areaExpanded,
    };
  });

  const finalHiddenById = new Map(
    nextNodesWithLeaves.map((node) => [node.id, node.hidden]),
  );
  const nextEdges = edges.map((edge) => ({
    ...edge,
    hidden: Boolean(
      finalHiddenById.get(edge.source) || finalHiddenById.get(edge.target),
    ),
  }));

  return getLayoutedElements(nextNodesWithLeaves, nextEdges);
};

const collectDescendants = (
  nodeId: string,
  childrenByParent: Map<string | null, SkillNode[]>,
  includeIds: Set<string>,
) => {
  const children = childrenByParent.get(nodeId) ?? [];
  children.forEach((child) => {
    if (!includeIds.has(child.id)) {
      includeIds.add(child.id);
      collectDescendants(child.id, childrenByParent, includeIds);
    }
  });
};

const filterSkillTreeNodes = (skillNodes: SkillNode[], query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return skillNodes;
  }

  const nodeById = new Map(skillNodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string | null, SkillNode[]>();
  skillNodes.forEach((node) => {
    const bucket = childrenByParent.get(node.parentId ?? null) ?? [];
    bucket.push(node);
    childrenByParent.set(node.parentId ?? null, bucket);
  });

  const includeIds = new Set<string>();

  skillNodes.forEach((node) => {
    const searchableText = [
      node.label,
      node.subtitle,
      node.drawerContent?.summary,
      node.drawerContent?.prerequisites,
      ...(node.drawerContent?.requiredSkills?.map((skill) => skill.label) ?? []),
      ...(node.drawerContent?.knowledgeBase?.tags ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!searchableText.includes(normalizedQuery)) {
      return;
    }

    includeIds.add(node.id);

    let parentId = node.parentId;
    while (parentId) {
      includeIds.add(parentId);
      parentId = nodeById.get(parentId)?.parentId ?? null;
    }

    if (node.level !== 3) {
      collectDescendants(node.id, childrenByParent, includeIds);
    }
  });

  return skillNodes.filter((node) => includeIds.has(node.id));
};

const materializeFlowNodes = (
  skillNodes: SkillNode[],
  options?: { expandAllAreas?: boolean; query?: string },
) => {
  const filtered = filterSkillTreeNodes(skillNodes, options?.query ?? "");
  const { nodes: initialNodes, edges } = generateFlowElements(filtered);
  const nextNodes = initialNodes.map((node) => {
    const data = node.data as unknown as SkillNode & { isExpanded?: boolean };
    const expandAllAreas = Boolean(options?.expandAllAreas);
    const hasQuery = Boolean(options?.query?.trim());

    return {
      ...node,
      data: {
        ...node.data,
        isExpanded:
          data.level === 1 ||
          (data.level === 2 ? expandAllAreas || hasQuery : data.isExpanded),
      },
    };
  }) as FlowNode[];

  return recalculateTreeVisibility(nextNodes, edges);
};

const SkillTreeToolbar = ({
  query,
  onQueryChange,
  onExpandAll,
  onCollapseAll,
  resultCount,
  statusMessage,
  searchLabel,
  searchPlaceholder,
  expandLabel,
  collapseLabel,
  resultCountLabel,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  resultCount: number;
  statusMessage: string;
  searchLabel: string;
  searchPlaceholder: string;
  expandLabel: string;
  collapseLabel: string;
  resultCountLabel: string;
}) => (
  <div
    className="absolute top-6 left-1/2 z-20 w-[min(44rem,calc(100%-8rem))] -translate-x-1/2 rounded-[1.35rem] border px-4 py-3 backdrop-blur-xl"
    style={{
      background: "var(--bg-floating)",
      borderColor: "var(--border-color)",
    }}
  >
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="relative flex-1">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: "var(--text-secondary)" }}
        />
        <input
          aria-label={searchLabel}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={searchPlaceholder}
          data-testid="skill-tree-search-input"
          className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--node-run-edge)]"
          style={{
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--border-color)",
            color: "var(--text-primary)",
          }}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onExpandAll}
          className="rounded-xl border px-3 py-2 text-[11px] font-medium"
          data-testid="skill-tree-expand-button"
          style={{
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--border-color)",
            color: "var(--text-primary)",
          }}
        >
          {expandLabel}
        </button>
        <button
          type="button"
          onClick={onCollapseAll}
          data-testid="skill-tree-collapse-button"
          className="rounded-xl border px-3 py-2 text-[11px] font-medium"
          style={{
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--border-color)",
            color: "var(--text-primary)",
          }}
        >
          {collapseLabel}
        </button>
        <div
          className="rounded-xl border px-3 py-2 text-[11px] font-medium"
          data-testid="skill-tree-result-count"
          style={{
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--border-color)",
            color: "var(--text-secondary)",
          }}
          aria-live="polite"
          aria-atomic="true"
          aria-label={resultCountLabel}
        >
          {resultCountLabel}
        </div>
      </div>
    </div>
    <div
      className="mt-2 text-[11px]"
      style={{ color: "var(--text-secondary)" }}
      role="status"
      aria-live="polite"
      data-testid="skill-tree-toolbar-status">
      {statusMessage}
    </div>
  </div>
);

function SkillTreeContent({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<SkillNode | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [allSkillTreeNodes, setAllSkillTreeNodes] = useState<SkillNode[]>([]);
  const [skillTreeQuery, setSkillTreeQuery] = useState("");
  const [expandAllAreas, setExpandAllAreas] = useState(false);
  const [treeStatusMessage, setTreeStatusMessage] = useState(t("skillTree.status.ready"));
  const deferredSkillTreeQuery = useDeferredValue(skillTreeQuery);
  const { fitView, setCenter } = useReactFlow();

  const handleTreeSearchChange = (value: string) => {
    setSkillTreeQuery(value);
    const trimmed = value.trim();
    setTreeStatusMessage(
      trimmed
        ? t("skillTree.status.filtering", { query: trimmed })
        : t("skillTree.status.showingAll"),
    );
  };

  const handleExpandAll = () => {
    setExpandAllAreas(true);
    setTreeStatusMessage(t("skillTree.status.expanded"));
  };

  const handleCollapseAll = () => {
    setExpandAllAreas(false);
    setTreeStatusMessage(t("skillTree.status.collapsed"));
  };

  useEffect(() => {
    let cancelled = false;

    fetchSkillTree().then(({ nodes: skillTreeNodes }) => {
      if (cancelled) {
        return;
      }
      setAllSkillTreeNodes(skillTreeNodes.length > 0 ? skillTreeNodes : mockSkillNodes);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const skillTreeNodes =
      allSkillTreeNodes.length > 0 ? allSkillTreeNodes : mockSkillNodes;
    const { nodes: layoutedNodes, edges: layoutedEdges } = materializeFlowNodes(
      skillTreeNodes,
      {
        expandAllAreas,
        query: deferredSkillTreeQuery,
      },
    );
    setNodes(layoutedNodes as FlowNode[]);
    setEdges(layoutedEdges);
    requestAnimationFrame(() => {
      fitView({ padding: 0.22, duration: 0 });
    });
  }, [allSkillTreeNodes, deferredSkillTreeQuery, expandAllAreas, fitView, setEdges, setNodes]);

  useEffect(() => {
    if (nodes.length === 0 || isDrawerOpen) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      fitView({ padding: 0.22, duration: 0 });
    });

    return () => cancelAnimationFrame(frame);
  }, [nodes.length, isDrawerOpen, fitView]);

  useEffect(() => {
    const unsubscribe = subscribeToStream((data) => {
      if (typeof data !== "object" || data === null) {
        return;
      }

      const streamData = data as {
        type?: string;
        nodeId?: string;
        status?: SkillNode["status"];
        drawerContent?: SkillNode["drawerContent"];
      };

      if (
        streamData.type !== "node-update" &&
        !(streamData.nodeId && streamData.status && !streamData.type)
      ) {
        return;
      }

      const { nodeId, status, drawerContent } = streamData;
      if (!nodeId || !status) {
        return;
      }

      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            const updatedData = { ...node.data, status };
            if (drawerContent) {
              updatedData.drawerContent = drawerContent;
            }
            if (selectedNode?.id === nodeId) {
              setSelectedNode(updatedData as unknown as SkillNode);
            }
            return { ...node, data: updatedData };
          }
          return node;
        }),
      );

      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.target === nodeId) {
            return {
              ...edge,
              style: {
                stroke:
                  status === "running"
                    ? "var(--node-run-edge)"
                    : "var(--edge-idle)",
                strokeWidth: status === "running" ? 2 : 1,
                strokeDasharray: status === "running" ? "5, 5" : "none",
                animation:
                  status === "running" ? "flow 0.5s linear infinite" : "none",
              },
            };
          }
          return edge;
        }),
      );
    });

    return unsubscribe;
  }, [selectedNode, setEdges, setNodes]);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, clickedNode: Node) => {
      const target = event.target as HTMLElement | null;
      const shouldToggle = Boolean(target?.closest('[data-expand-toggle="true"]'));
      const skillNode = clickedNode.data as unknown as SkillNode & { isExpanded?: boolean };

      if (shouldToggle && (skillNode.level === 1 || skillNode.level === 2)) {
        const nextNodes = nodes.map((node) =>
          node.id === clickedNode.id
            ? {
                ...node,
                data: {
                  ...node.data,
                  isExpanded: !(node.data as { isExpanded?: boolean }).isExpanded,
                },
              }
            : node,
        ) as FlowNode[];

        const { nodes: layoutedNodes, edges: layoutedEdges } =
          recalculateTreeVisibility(nextNodes, edges);
        setNodes(layoutedNodes as FlowNode[]);
        setEdges(layoutedEdges);
        return;
      }

      if (skillNode.drawerContent) {
        setSelectedNode(skillNode);
        setIsDrawerOpen(true);
        setTreeStatusMessage(t("skillTree.status.viewing", { label: skillNode.label }));

        setCenter(clickedNode.position.x + 180, clickedNode.position.y, {
          zoom: skillNode.level === 3 ? 1.2 : 1.05,
          duration: 800,
        });
      }
    },
    [edges, nodes, setCenter, setEdges, setNodes, setTreeStatusMessage],
  );

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedNode(null);
    setTreeStatusMessage(
      skillTreeQuery.trim()
        ? t("skillTree.status.filtering", { query: skillTreeQuery.trim() })
        : t("skillTree.status.ready"),
    );
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 800 });
    }, 100);
  }, [fitView, skillTreeQuery, setTreeStatusMessage]);

  return (
    <div
      className="w-full h-full relative p-4 md:p-8 lg:p-12"
      data-testid="skill-tree-view"
    >
      <div className="absolute top-6 left-6 z-20">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-md border shadow-sm text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5 backdrop-blur-md"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border-color)",
            color: "var(--text-primary)",
          }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("tree.back")}
        </button>
      </div>

      <SkillTreeToolbar
        query={skillTreeQuery}
        onQueryChange={handleTreeSearchChange}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        resultCount={nodes.filter((node) => !node.hidden).length}
        statusMessage={treeStatusMessage}
        searchLabel={t("skillTree.search.label")}
        searchPlaceholder={t("skillTree.search.placeholder")}
        expandLabel={t("skillTree.expandAll")}
        collapseLabel={t("skillTree.collapseAreas")}
        resultCountLabel={t("skillTree.resultCount", {
          count: nodes.filter((node) => !node.hidden).length,
        })}
      />

      <ReactFlow
        data-testid="skill-tree-canvas"
        aria-label={t("skillTree.canvas")}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        className="bg-transparent"
        minZoom={0.1}
        maxZoom={2}
        panOnScroll
        selectionOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        panOnDrag
        nodesDraggable={false}
        preventScrolling={false}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(150,150,150,0.2)"
        />
      </ReactFlow>

      <GlassDrawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        node={selectedNode}
      />
    </div>
  );
}

export default function SkillTreeView({ onBack }: { onBack: () => void }) {
  return (
    <ReactFlowProvider>
      <SkillTreeContent onBack={onBack} />
    </ReactFlowProvider>
  );
}
