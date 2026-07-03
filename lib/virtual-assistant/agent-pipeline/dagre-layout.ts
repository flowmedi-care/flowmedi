import dagre from "@dagrejs/dagre";
import type { PipelineViewTab } from "./view-filter";
import type { UnifiedGraphEdge, UnifiedGraphNode } from "./unified-flow-graph";

const GLOBAL_STAGE_CODES = new Set(["financeiro", "formularios", "escalonamento"]);

const NODE_SIZES: Record<string, { width: number; height: number }> = {
  stage: { width: 180, height: 72 },
  runtime: { width: 130, height: 52 },
  switch: { width: 150, height: 60 },
  hub: { width: 110, height: 48 },
  gate: { width: 110, height: 48 },
  anchor: { width: 12, height: 12 },
  default: { width: 100, height: 44 },
};

export type DagreLayoutOptions = {
  tab: PipelineViewTab;
  rankSep?: number;
  nodeSep?: number;
};

function getNodeSize(node: UnifiedGraphNode): { width: number; height: number } {
  if (node.kind === "stage") return NODE_SIZES.stage;
  if (node.kind === "switch") return NODE_SIZES.switch;
  if (node.kind === "hub" || node.kind === "gate") return NODE_SIZES[node.kind];
  if (node.kind === "runtime") return NODE_SIZES.runtime;
  if (node.kind === "anchor") return NODE_SIZES.anchor;
  return NODE_SIZES.default;
}

function runDagre(
  nodes: UnifiedGraphNode[],
  edges: UnifiedGraphEdge[],
  direction: "LR" | "TB",
  rankSep: number,
  nodeSep: number
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    ranksep: rankSep,
    nodesep: nodeSep,
    ranker: "network-simplex",
    marginx: 24,
    marginy: 24,
  });

  for (const n of nodes) {
    const size = getNodeSize(n);
    g.setNode(n.id, { width: size.width, height: size.height });
  }

  for (const e of edges) {
    if (g.hasNode(e.from) && g.hasNode(e.to)) {
      g.setEdge(e.from, e.to);
    }
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const dagreNode = g.node(n.id);
    if (dagreNode) {
      positions.set(n.id, {
        x: dagreNode.x - dagreNode.width / 2,
        y: dagreNode.y - dagreNode.height / 2,
      });
    }
  }
  return positions;
}

function applyJourneyLayout(
  nodes: UnifiedGraphNode[],
  edges: UnifiedGraphEdge[],
  opts: DagreLayoutOptions
): UnifiedGraphNode[] {
  const rankSep = opts.rankSep ?? 72;
  const nodeSep = opts.nodeSep ?? 48;

  const mainNodes = nodes.filter(
    (n) => n.kind === "stage" && !GLOBAL_STAGE_CODES.has(n.stageCode ?? "")
  );
  const globalNodes = nodes.filter(
    (n) => n.kind === "stage" && GLOBAL_STAGE_CODES.has(n.stageCode ?? "")
  );
  const mainEdges = edges.filter((e) => e.kind === "stage_transition");

  const positions = runDagre(mainNodes, mainEdges, "LR", rankSep, nodeSep);

  let maxBottom = 0;
  let minX = 40;
  for (const n of mainNodes) {
    const pos = positions.get(n.id);
    if (!pos) continue;
    const size = getNodeSize(n);
    maxBottom = Math.max(maxBottom, pos.y + size.height);
    minX = Math.min(minX, pos.x);
  }

  const globalY = maxBottom + 88;
  const globalSpacing = 220;
  globalNodes.forEach((n, i) => {
    positions.set(n.id, { x: minX + i * globalSpacing, y: globalY });
  });

  return nodes.map((n) => {
    const pos = positions.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });
}

function applyExecutionLayout(
  nodes: UnifiedGraphNode[],
  edges: UnifiedGraphEdge[],
  opts: DagreLayoutOptions
): UnifiedGraphNode[] {
  const rankSep = opts.rankSep ?? 56;
  const nodeSep = opts.nodeSep ?? 36;

  const layoutNodes = nodes.filter(
    (n) =>
      n.kind === "runtime" ||
      n.kind === "switch" ||
      n.kind === "hub" ||
      n.kind === "gate" ||
      n.kind === "anchor"
  );
  const layoutEdges = edges.filter(
    (e) =>
      e.kind === "runtime" ||
      e.kind === "context" ||
      e.kind === "return" ||
      e.kind === "parallel"
  );

  const positions = runDagre(layoutNodes, layoutEdges, "LR", rankSep, nodeSep);

  return nodes.map((n) => {
    const pos = positions.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });
}

function applyExitsLayout(
  nodes: UnifiedGraphNode[],
  edges: UnifiedGraphEdge[],
  opts: DagreLayoutOptions
): UnifiedGraphNode[] {
  const rankSep = opts.rankSep ?? 64;
  const nodeSep = opts.nodeSep ?? 40;

  const layoutNodes = nodes.filter(
    (n) =>
      n.kind === "stage" ||
      n.kind === "runtime" ||
      n.kind === "hub" ||
      n.kind === "gate" ||
      n.kind === "anchor"
  );
  const layoutEdges = edges.filter(
    (e) =>
      e.kind === "transversal" ||
      e.kind === "runtime" ||
      e.kind === "return" ||
      (e.kind === "context" && !e.id.startsWith("dyn-stage-tools"))
  );

  const positions = runDagre(layoutNodes, layoutEdges, "TB", rankSep, nodeSep);

  return nodes.map((n) => {
    const pos = positions.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });
}

export function applyDagreLayout(
  nodes: UnifiedGraphNode[],
  edges: UnifiedGraphEdge[],
  opts: DagreLayoutOptions
): UnifiedGraphNode[] {
  const tab = opts.tab === "playback" ? "execution" : opts.tab;
  const layoutable = nodes.filter((n) => n.kind !== "swimlane");

  if (layoutable.length === 0) return nodes;

  let laidOut: UnifiedGraphNode[];
  if (tab === "journey") {
    laidOut = applyJourneyLayout(layoutable, edges, opts);
  } else if (tab === "execution") {
    laidOut = applyExecutionLayout(layoutable, edges, opts);
  } else if (tab === "exits") {
    laidOut = applyExitsLayout(layoutable, edges, opts);
  } else {
    return nodes;
  }

  const posById = new Map(laidOut.map((n) => [n.id, n.position]));
  return nodes.map((n) => {
    const pos = posById.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });
}

/** Etapas principais da jornada (exclui globais) — útil em testes. */
export function getMainJourneyStageNodes(nodes: UnifiedGraphNode[]): UnifiedGraphNode[] {
  return nodes.filter(
    (n) => n.kind === "stage" && !GLOBAL_STAGE_CODES.has(n.stageCode ?? "")
  );
}
