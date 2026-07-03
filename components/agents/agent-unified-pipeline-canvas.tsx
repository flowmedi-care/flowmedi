"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useReactFlow,
  type Node,
  type Edge,
  Position,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PipelineTrace } from "@/lib/operational-agents/pipeline-trace";
import {
  DEMO_CYCLE,
  buildDemoTrace,
} from "@/lib/operational-agents/pipeline-trace";
import {
  buildUnifiedGraph,
  EDGE_KIND_LABELS,
  EDGE_STYLES,
  FLOW_EXPLANATION,
  getToolPrimaryStage,
  nodeBelongsToView,
  resolveUnifiedPipelineHighlight,
  getDemoStageForTick,
  type AgentPipelineStage,
} from "@/lib/virtual-assistant/agent-pipeline";
import type { ToolExecutionModesConfig } from "@/lib/virtual-assistant/agent-pipeline/confirmation-policy";
import { ASSISTANT_TOOL_CATALOG } from "@/lib/virtual-assistant/tools/catalog";
import { RuntimePipelineNode } from "./unified-pipeline/runtime-pipeline-node";
import { StagePipelineNode } from "./unified-pipeline/stage-pipeline-node";
import { ToolPipelineNode } from "./unified-pipeline/tool-pipeline-node";
import { RouteAnchorNode } from "./unified-pipeline/route-anchor-node";
import { OrthogonalEdge } from "./unified-pipeline/orthogonal-edge";
import { PoolGroupNode } from "./unified-pipeline/pool-group-node";

export type PipelineViewMode = "unified" | "runtime" | "journey";

export type AgentUnifiedPipelineCanvasProps = {
  trace?: PipelineTrace | null;
  currentStage?: AgentPipelineStage | null;
  parallelStages?: AgentPipelineStage[];
  lastToolName?: string | null;
  toolModes?: ToolExecutionModesConfig;
  demoStage?: AgentPipelineStage | null;
  variant?: "full" | "compact";
  showExpandButton?: boolean;
  showLegend?: boolean;
  className?: string;
  viewMode?: PipelineViewMode;
  onViewModeChange?: (mode: PipelineViewMode) => void;
};

const nodeTypes = {
  runtime: RuntimePipelineNode,
  hub: RuntimePipelineNode,
  stage: StagePipelineNode,
  tool: ToolPipelineNode,
  anchor: RouteAnchorNode,
  pool: PoolGroupNode,
};

const edgeTypes = {
  orthogonal: OrthogonalEdge,
};

function countToolsForStage(stageKey: string): number {
  return ASSISTANT_TOOL_CATALOG.filter((t) => {
    const s = getToolPrimaryStage(t.name);
    if (stageKey === "escalonamento") return t.name === "transfer_to_human";
    return s === stageKey;
  }).length;
}

function FitViewOnChange({ deps }: { deps: unknown[] }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const t = setTimeout(() => {
      void fitView({ padding: 0.18, duration: 320 });
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit when graph layout changes
  }, deps);
  return null;
}

function ViewModeToggle({
  value,
  onChange,
  compact,
}: {
  value: PipelineViewMode;
  onChange: (m: PipelineViewMode) => void;
  compact?: boolean;
}) {
  if (compact) return null;
  const modes: { id: PipelineViewMode; label: string }[] = [
    { id: "unified", label: "Unificado" },
    { id: "runtime", label: "Execução" },
    { id: "journey", label: "Jornada CRM" },
  ];
  return (
    <div className="absolute right-2 top-2 z-10 flex gap-1 rounded-lg border bg-background/95 p-0.5 shadow-sm backdrop-blur-sm">
      {modes.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          className={cn(
            "rounded-md px-2 py-1 text-[9px] font-medium transition-colors",
            value === m.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

function UnifiedPipelineCanvasInner({
  trace,
  currentStage,
  parallelStages = [],
  lastToolName,
  toolModes,
  demoStage,
  variant = "full",
  showExpandButton = true,
  showLegend = true,
  className,
  viewMode: viewModeProp,
  onViewModeChange,
}: AgentUnifiedPipelineCanvasProps) {
  const compact = variant === "compact";
  const [expanded, setExpanded] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(() => new Set());
  const [demoTick, setDemoTick] = useState(0);
  const [internalViewMode, setInternalViewMode] = useState<PipelineViewMode>("unified");
  const viewMode = viewModeProp ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;

  const isLive = trace?.isLive ?? false;
  const demoTrace = buildDemoTrace(demoTick);
  const effectiveTrace = isLive && trace ? trace : demoTrace;
  const activeStage = demoStage ?? currentStage ?? (isLive ? currentStage : getDemoStageForTick(demoTick));

  useEffect(() => {
    if (isLive) return;
    const interval = setInterval(() => {
      setDemoTick((p) => (p + 1) % DEMO_CYCLE.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [isLive]);

  useEffect(() => {
    if (activeStage) {
      setExpandedStages((prev) => new Set(prev).add(activeStage));
    }
  }, [activeStage]);

  const highlight = useMemo(
    () =>
      resolveUnifiedPipelineHighlight({
        trace: effectiveTrace,
        currentStage: activeStage,
        parallelStages,
        lastToolName,
        expandedStages,
      }),
    [effectiveTrace, activeStage, parallelStages, lastToolName, expandedStages]
  );

  const toggleStage = useCallback((stageId: string) => {
    setExpandedStages((prev) => {
      if (prev.has(stageId)) return new Set();
      return new Set([stageId]);
    });
  }, []);

  const { nodes, edges } = useMemo(() => {
    const graph = buildUnifiedGraph({
      expandedStages,
      activeStage,
      parallelStages,
    });
    const compactScale = compact ? 0.55 : 1;

    const flowNodes: Node[] = [];

    for (const n of graph.nodes) {
      const pool = n.poolId ?? null;
      if (!nodeBelongsToView(n.id, pool as Parameters<typeof nodeBelongsToView>[1], viewMode)) {
        continue;
      }

      const basePosition = {
        x: n.position.x * compactScale,
        y: n.position.y * compactScale,
      };

      if (n.kind === "pool") {
        flowNodes.push({
          id: n.id,
          type: "pool",
          position: basePosition,
          data: {
            label: n.label,
            width: (n.poolWidth ?? 400) * compactScale,
            height: (n.poolHeight ?? 200) * compactScale,
          },
          draggable: false,
          selectable: false,
          zIndex: -1,
        });
        continue;
      }

      if (n.kind === "anchor") {
        if (viewMode !== "unified") continue;
        flowNodes.push({
          id: n.id,
          type: "anchor",
          position: basePosition,
          data: {},
          selectable: false,
          draggable: false,
          zIndex: 0,
        });
        continue;
      }

      if (n.kind === "runtime" || n.kind === "hub") {
        const isActive = highlight.activeRuntimeNodeIds.includes(n.id);
        flowNodes.push({
          id: n.id,
          type: n.kind === "hub" ? "hub" : "runtime",
          position: basePosition,
          data: {
            node: n,
            state: isActive ? "active" : "idle",
            compact,
          },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          zIndex: 10,
        });
        continue;
      }

      if (n.kind === "stage") {
        const stageKey = n.stageCode ?? "";
        const isCurrent = highlight.activeStageNodeId === n.id;
        const isParallel = parallelStages.includes(stageKey as AgentPipelineStage);
        let state: "current" | "completed" | "upcoming" | "parallel" | "transversal" = "upcoming";
        if (stageKey === "escalonamento") state = "transversal";
        else if (isCurrent) state = "current";
        else if (isParallel) state = "parallel";

        const toolCount = countToolsForStage(stageKey);
        const isExpanded = expandedStages.has(stageKey);

        flowNodes.push({
          id: n.id,
          type: "stage",
          position: basePosition,
          data: {
            node: n,
            state,
            expanded: isExpanded,
            toolCount,
            compact,
            onToggle: toggleStage,
          },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          zIndex: 8,
        });
        continue;
      }

      const isActive = highlight.activeToolIds.includes(n.id);
      const confirmMode = n.toolName && toolModes ? toolModes[n.toolName] : undefined;
      flowNodes.push({
        id: n.id,
        type: "tool",
        position: basePosition,
        data: {
          node: n,
          state: isActive ? "active" : "idle",
          confirmMode,
          compact,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        zIndex: 6,
      });
    }

    const visibleNodeIds = new Set(flowNodes.map((n) => n.id));

    const flowEdges: Edge[] = graph.edges
      .filter((e) => {
        if (!visibleNodeIds.has(e.from) || !visibleNodeIds.has(e.to)) return false;
        if (viewMode === "runtime") {
          return (
            e.from.startsWith("runtime_") ||
            e.to.startsWith("runtime_") ||
            e.from.startsWith("anchor_") ||
            e.to.startsWith("anchor_") ||
            e.id.startsWith("dyn-")
          );
        }
        if (viewMode === "journey") {
          return (
            !e.from.startsWith("runtime_") ||
            e.id.startsWith("dyn-") ||
            e.from === "runtime_resolver"
          );
        }
        return true;
      })
      .map((e) => {
        const style = EDGE_STYLES[e.kind];
        const isActive =
          highlight.activeRuntimeEdgeIds.includes(e.id) ||
          highlight.activeEdgeIds.includes(e.id) ||
          e.id === highlight.activeResolverEdgeId ||
          e.id === highlight.activeStageToHubEdgeId;

        const strokeColor = isActive ? "hsl(var(--primary))" : style.stroke;

        return {
          id: e.id,
          source: e.from,
          target: e.to,
          type: "orthogonal",
          label: compact ? undefined : e.label,
          animated: Boolean(isActive),
          data: { routing: e.routing },
          style: {
            stroke: strokeColor,
            strokeWidth: isActive ? style.strokeWidth + 1 : style.strokeWidth,
            strokeDasharray: style.strokeDasharray,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 12,
            height: 12,
            color: strokeColor,
          },
          labelStyle: { fontSize: 9, fill: "#475569", fontWeight: 500 },
          labelBgStyle: { fill: "hsl(var(--background))", fillOpacity: 0.95 },
          labelBgPadding: [4, 6] as [number, number],
          labelBgBorderRadius: 4,
          zIndex: 0,
        } satisfies Edge;
      });

    return { nodes: flowNodes, edges: flowEdges };
  }, [
    expandedStages,
    compact,
    highlight,
    parallelStages,
    toolModes,
    toggleStage,
    activeStage,
    viewMode,
  ]);

  const canvas = (
    <div className={cn("relative h-full w-full [&_.react-flow__edge-path]:stroke-[inherit]", className)}>
      <ViewModeToggle value={viewMode} onChange={setViewMode} compact={compact} />

      {showLegend && !compact && (
        <div className="absolute left-2 top-2 z-10 max-w-[240px] rounded-lg border bg-background/95 p-2.5 text-[9px] shadow-sm backdrop-blur-sm">
          <p className="font-semibold mb-1">{FLOW_EXPLANATION.title}</p>
          <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground mb-2">
            {FLOW_EXPLANATION.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="font-semibold mb-1 border-t pt-1.5">Tipos de linha</p>
          <ul className="space-y-0.5 text-muted-foreground">
            {(Object.keys(EDGE_KIND_LABELS) as (keyof typeof EDGE_KIND_LABELS)[]).map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-0.5 w-4 shrink-0"
                  style={{
                    background: EDGE_STYLES[k].stroke,
                    borderTop: EDGE_STYLES[k].strokeDasharray
                      ? `1px dashed ${EDGE_STYLES[k].stroke}`
                      : undefined,
                  }}
                />
                {EDGE_KIND_LABELS[k]}
              </li>
            ))}
          </ul>
          {activeStage && (
            <p className="mt-2 rounded bg-primary/10 px-1.5 py-1 text-[8px] text-primary font-medium">
              Etapa ativa: {activeStage.replace(/_/g, " ")}
            </p>
          )}
          <p className="mt-1.5 text-[8px] text-muted-foreground">
            Clique numa etapa para expandir tools e dependências.
          </p>
        </div>
      )}

      {!isLive && !compact && (
        <span className="absolute bottom-2 right-2 z-10 rounded bg-muted/80 px-1.5 py-0.5 text-[8px] font-mono text-muted-foreground">
          demo · {effectiveTrace.activeStep}
          {activeStage ? ` · ${activeStage}` : ""}
        </span>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: "orthogonal",
          markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
        }}
        fitView
        fitViewOptions={{ padding: compact ? 0.12 : 0.18 }}
        minZoom={compact ? 0.06 : 0.08}
        maxZoom={compact ? 0.9 : 1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        elevateEdgesOnSelect={false}
        proOptions={{ hideAttribution: true }}
      >
        <FitViewOnChange deps={[expandedStages, compact, viewMode, nodes.length, edges.length, activeStage]} />
        <Background gap={compact ? 16 : 28} size={1} />
        {!compact && <Controls showInteractive={false} />}
        {!compact && <MiniMap zoomable pannable className="!bg-background/80" />}
      </ReactFlow>
    </div>
  );

  if (!showExpandButton) {
    return (
      <div className={cn("h-full min-h-[180px] rounded-xl border bg-card overflow-hidden", className)}>
        {canvas}
      </div>
    );
  }

  return (
    <>
      <div className={cn("relative h-full min-h-[520px] rounded-2xl border bg-card overflow-hidden", className)}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-12 z-20 h-7 w-7 bg-background/70 backdrop-blur-sm"
          onClick={() => setExpanded(true)}
          aria-label="Expandir mapa do pipeline"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        {canvas}
      </div>

      {expanded &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-sm"
            role="dialog"
            aria-modal
          >
            <div className="flex items-center justify-between border-b px-4 py-2">
              <div>
                <p className="text-sm font-semibold">Mapa unificado do pipeline</p>
                <p className="text-xs text-muted-foreground">
                  Pools: Ingresso → Execução → Jornada → Ramificações → Escalonamento
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(false)}>
                <Minimize2 className="h-4 w-4 mr-1" />
                Fechar
              </Button>
            </div>
            <div className="flex-1 min-h-0 p-2">{canvas}</div>
          </div>,
          document.body
        )}
    </>
  );
}

export function AgentUnifiedPipelineCanvas(props: AgentUnifiedPipelineCanvasProps) {
  return (
    <ReactFlowProvider>
      <UnifiedPipelineCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

export default AgentUnifiedPipelineCanvas;
