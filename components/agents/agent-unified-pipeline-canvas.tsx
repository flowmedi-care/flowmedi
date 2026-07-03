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
  getToolPrimaryStage,
  resolveUnifiedPipelineHighlight,
  getDemoStageForTick,
  type AgentPipelineStage,
} from "@/lib/virtual-assistant/agent-pipeline";
import type { ToolExecutionModesConfig } from "@/lib/virtual-assistant/agent-pipeline/confirmation-policy";
import { ASSISTANT_TOOL_CATALOG } from "@/lib/virtual-assistant/tools/catalog";
import { RuntimePipelineNode } from "./unified-pipeline/runtime-pipeline-node";
import { StagePipelineNode } from "./unified-pipeline/stage-pipeline-node";
import { ToolPipelineNode } from "./unified-pipeline/tool-pipeline-node";

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
};

const nodeTypes = {
  runtime: RuntimePipelineNode,
  hub: RuntimePipelineNode,
  stage: StagePipelineNode,
  tool: ToolPipelineNode,
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
      void fitView({ padding: 0.14, duration: 280 });
    }, 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit when graph layout changes
  }, deps);
  return null;
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
}: AgentUnifiedPipelineCanvasProps) {
  const compact = variant === "compact";
  const [expanded, setExpanded] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(() => new Set());
  const [demoTick, setDemoTick] = useState(0);

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
    const graph = buildUnifiedGraph({ expandedStages });
    const compactScale = compact ? 0.55 : 1;

    const flowNodes: Node[] = graph.nodes.map((n) => {
      const basePosition = {
        x: n.position.x * compactScale,
        y: n.position.y * compactScale,
      };

      if (n.kind === "runtime" || n.kind === "hub") {
        const isActive = highlight.activeRuntimeNodeIds.includes(n.id);
        return {
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
        };
      }

      if (n.kind === "stage") {
        const stageKey = n.stageCode ?? "";
        const isCurrent = highlight.activeStageNodeId === n.id;
        const isParallel = parallelStages.includes(stageKey as AgentPipelineStage);
        let state: "current" | "completed" | "upcoming" | "parallel" | "transversal" = "upcoming";
        if (stageKey === "escalonamento") state = "transversal";
        else if (isCurrent) state = "current";
        else if (isParallel) state = "parallel";
        else if (n.stageCode && parallelStages.includes(n.stageCode as AgentPipelineStage))
          state = "parallel";

        const toolCount = countToolsForStage(stageKey);
        const isExpanded = expandedStages.has(stageKey);

        return {
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
        };
      }

      // tool — posição global (sem parentId)
      const isActive = highlight.activeToolIds.includes(n.id);
      const confirmMode = n.toolName && toolModes ? toolModes[n.toolName] : undefined;
      return {
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
      };
    });

    const verticalEdges = new Set([
      "rt-agent-journey",
      "rt-journey-agent",
      "rt-agent-resolver",
      "rt-journey-resolver",
      "rt-tools-agent",
      "rt-confirm-agent",
      "res-stage-entry",
      "res-stage-bridge",
    ]);

    const flowEdges: Edge[] = graph.edges.map((e) => {
      const style = EDGE_STYLES[e.kind];
      const isActive =
        highlight.activeRuntimeEdgeIds.includes(e.id) ||
        highlight.activeEdgeIds.includes(e.id) ||
        (highlight.activeStageNodeId &&
          (e.from === highlight.activeStageNodeId || e.to === highlight.activeStageNodeId));

      const strokeColor = isActive ? "hsl(var(--primary))" : style.stroke;

      const edge: Edge = {
        id: e.id,
        source: e.from,
        target: e.to,
        type: "smoothstep",
        label: compact ? undefined : e.label,
        animated: Boolean(isActive),
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
      };

      if (verticalEdges.has(e.id)) {
        if (e.from === "runtime_agent" || e.from === "runtime_journey" || e.from === "runtime_resolver") {
          edge.sourceHandle = e.from === "runtime_agent" && e.to.includes("journey") ? "bottom" : "bottom";
        }
        if (e.to === "runtime_journey" || e.to === "runtime_agent" || e.to.startsWith("stage_")) {
          edge.targetHandle = "top";
        }
        if (e.id === "rt-journey-agent") {
          edge.sourceHandle = undefined;
          edge.targetHandle = "top";
        }
      }

      if (e.from.startsWith("stage_") && e.to.startsWith("tool_")) {
        edge.sourceHandle = "bottom";
      }

      return edge;
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [
    expandedStages,
    compact,
    highlight,
    parallelStages,
    toolModes,
    toggleStage,
  ]);

  const canvas = (
    <div className={cn("relative h-full w-full [&_.react-flow__edge-path]:stroke-[inherit]", className)}>
      {showLegend && !compact && (
        <div className="absolute left-2 top-2 z-10 max-w-[200px] rounded-lg border bg-background/95 p-2 text-[9px] shadow-sm backdrop-blur-sm">
          <p className="font-semibold mb-1">Legenda</p>
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
          <p className="mt-1.5 text-[8px] text-muted-foreground">
            Clique numa etapa para expandir tools e ver dependências.
          </p>
        </div>
      )}

      {!isLive && !compact && (
        <span className="absolute bottom-2 right-2 z-10 rounded bg-muted/80 px-1.5 py-0.5 text-[8px] font-mono text-muted-foreground">
          demo · {effectiveTrace.activeStep}
        </span>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
        }}
        fitView
        fitViewOptions={{ padding: compact ? 0.1 : 0.14 }}
        minZoom={compact ? 0.12 : 0.15}
        maxZoom={compact ? 0.9 : 1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        elevateEdgesOnSelect={false}
        proOptions={{ hideAttribution: true }}
      >
        <FitViewOnChange deps={[expandedStages, compact, nodes.length, edges.length]} />
        <Background gap={compact ? 12 : 20} size={1} />
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
          className="absolute right-2 top-2 z-20 h-7 w-7 bg-background/70 backdrop-blur-sm"
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
                  Mensagem → Roteador → Agente → Jornada → Etapas → Ferramentas → Resposta
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
