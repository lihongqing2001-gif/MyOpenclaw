import { Edge, Node, Position } from "@xyflow/react";
import { SkillNode } from "../types";

const nodeWidth = 232;
const nodeHeight = 92;
const columnGap = 140;
const rowGap = 34;
const leftPadding = 60;
const topPadding = 40;

function buildStableTreeLayout(nodes: Node[], edges: Edge[]) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string | null, Node[]>();

  for (const node of nodes) {
    const skillNode = node.data as unknown as SkillNode;
    const parentId = skillNode.parentId ?? null;
    const bucket = childrenByParent.get(parentId) ?? [];
    bucket.push(node);
    childrenByParent.set(parentId, bucket);
  }

  const positions = new Map<string, { x: number; y: number }>();
  let cursorY = topPadding;

  const layoutNode = (node: Node): number => {
    if (node.hidden) {
      return cursorY;
    }

    const skillNode = node.data as unknown as SkillNode;
    const visibleChildren = (childrenByParent.get(node.id) ?? []).filter(
      (child) => !child.hidden,
    );

    const x = leftPadding + (skillNode.level - 1) * (nodeWidth + columnGap);

    if (visibleChildren.length === 0) {
      const y = cursorY;
      positions.set(node.id, { x, y });
      cursorY += nodeHeight + rowGap;
      return y;
    }

    const childYs = visibleChildren.map((child) => layoutNode(child));
    const firstY = childYs[0];
    const lastY = childYs[childYs.length - 1];
    const y = firstY + (lastY - firstY) / 2;
    positions.set(node.id, { x, y });
    return y;
  };

  const roots = (childrenByParent.get(null) ?? []).filter((node) => !node.hidden);
  roots.forEach((root) => layoutNode(root));

  const nextNodes = nodes.map((node) => {
    if (node.hidden) {
      return node;
    }

    const position = positions.get(node.id) ?? { x: leftPadding, y: topPadding };
    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position,
    };
  });

  return { nodes: nextNodes, edges };
}

export const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  return buildStableTreeLayout(nodes, edges);
};

export const generateFlowElements = (skillNodes: SkillNode[]) => {
  const nodes: Node[] = skillNodes.map((sn) => ({
    id: sn.id,
    type: "skillNode",
    data: { ...sn, isExpanded: sn.level === 1 },
    hidden: sn.level === 3,
    position: { x: 0, y: 0 },
  }));

  const edges: Edge[] = skillNodes
    .filter((sn) => sn.parentId)
    .map((sn) => ({
      id: `e-${sn.parentId}-${sn.id}`,
      source: sn.parentId!,
      target: sn.id,
      type: "smoothstep",
      hidden: sn.level === 3,
      style: {
        stroke: sn.status === "running" ? "var(--node-run-edge)" : "var(--edge-idle)",
        strokeWidth: sn.status === "running" ? 2 : 1,
        strokeDasharray: sn.status === "running" ? "5, 5" : "none",
        animation: sn.status === "running" ? "flow 0.5s linear infinite" : "none",
      },
    }));

  return getLayoutedElements(nodes, edges);
};
