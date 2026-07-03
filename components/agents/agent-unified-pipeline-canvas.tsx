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
import { Maximize2, Minimize2, Pause, Play, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PipelineTrace } from "@/lib/operational-agents/pipeline-trace";
import { buildDemoTrace, DEMO_CYCLE } from "@/lib/operational-agents/pipeline-trace";
import {
  buildUnifiedGraph,
  EDGE_KIND_LABELS,
  EDGE_STYLES,
  FLOW_EXPLANATION,
  getToolPrimaryStage,
  PLAYBACK_STEPS,
  resolveUnifiedPipelineHighlight,
  getDemoStageForTick,
  type AgentPipelineStage,
} from "@/lib/virtual-assistant/agent-pipeline";
import {
  filterGraphForView,
  stageNodeId,
  type JourneyDisplayMode,
  type PipelineViewTab,
} from "@/lib/virtual-assistant/agent-pipeline/view-filter";
import type { ToolExecutionModesConfig } from "@/lib/virtual-assistant/agent-pipeline/confirmation-policy";
import { ASSISTANT_TOOL_CATALOG } from "@/lib/virtual-assistant/tools/catalog";
import { RuntimePipelineNode } from "./unified-pipeline/runtime-pipeline-node";
import { StagePipelineNode } from "./unified-pipeline/stage-pipeline-node";
import { ToolPipelineNode } from "./unified-pipeline/tool-pipeline-node";
import { RouteAnchorNode } from "./unified-pipeline/route-anchor-node";
import { OrthogonalEdge } from "./unified-pipeline/orthogonal-edge";
import { SwimlaneBackgroundNode } from "./unified-pipeline/swimlane-background";
import { SwitchPipelineNode } from "./unified-pipeline/switch-pipeline-node";
import { StageDetailPanel } from "./unified-pipeline/stage-detail-panel";
import { StageStepper } from "./unified-pipeline/stage-stepper";

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
  gate: RuntimePipelineNode,
  switch: SwitchPipelineNode,
  stage: StagePipelineNode,
  tool: ToolPipelineNode,
  anchor: RouteAnchorNode,
  swimlane: SwimlaneBackgroundNode,
};

const edgeTypes = { orthogonal: OrthogonalEdge };

const VIEW_TABS: { id: PipelineViewTab; label: string }[] = [
  { id: "journey", label: "Jornada CRM" },
  { id: "execution", label: "Execução" },
  { id: "exits", label: "Saídas" },
  { id: "playback", label: "Passo a passo" },
];

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
    const t = setTimeout(() => void fitView({ padding: 0.18, duration: 320 }), 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const { fitView } = useReactFlow();
  const [expanded, setExpanded] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(() => new Set());
  const [demoTick, setDemoTick] = useState(0);
  const [viewTab, setViewTab] = useState<PipelineViewTab>("journey");
  const [journeyMode, setJourneyMode] = useState<JourneyDisplayMode>("active");
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackPlaying, setPlaybackPlaying] = useState(false);
  const [selectedStage, setSelectedStage] = useState<AgentPipelineStage | "escalonamento" | null>(null);
  const [focusStage, setFocusStage] = useState<AgentPipelineStage | "escalonamento" | null>(null);

  const isLive = trace?.isLive ?? false;
  const demoTrace = buildDemoTrace(demoTick);
  const effectiveTrace = isLive && trace ? trace : demoTrace;
  const activeStage = demoStage ?? currentStage ?? (isLive ? currentStage : getDemoStageForTick(demoTick));

  useEffect(() => {
    if (isLive || viewTab === "playback") return;
    const interval = setInterval(() => setDemoTick((p) => (p + 1) % DEMO_CYCLE.length), 2200);
    return () => clearInterval(interval);
  }, [isLive, viewTab]);

  useEffect(() => {
    if (activeStage) setExpandedStages((prev) => new Set(prev).add(activeStage));
  }, [activeStage]);

  useEffect(() => {
    if (!playbackPlaying || viewTab !== "playback") return;
    const interval = setInterval(() => {
      setPlaybackIndex((p) => (p + 1) % PLAYBACK_STEPS.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [playbackPlaying, viewTab]);

  const highlight = useMemo(
    () =>
      resolveUnifiedPipelineHighlight({
        trace: effectiveTrace,
        currentStage: activeStage,
        parallelStages,
        lastToolName,
        playbackStepIndex: viewTab === "playback" ? playbackIndex : null,
        playbackMode: viewTab === "playback",
      }),
    [effectiveTrace, activeStage, parallelStages, lastToolName, viewTab, playbackIndex]
  );

  const toggleStage = useCallback((stageId: string) => {
    setSelectedStage(stageId as AgentPipelineStage);
    setFocusStage(stageId as AgentPipelineStage);
    setExpandedStages((prev) => {
      if (prev.has(stageId)) return new Set();
      return new Set([stageId]);
    });
  }, []);

  const handleStepperSelect = useCallback(
    (code: AgentPipelineStage | "escalonamento") => {
      setSelectedStage(code);
      setFocusStage(code);
      if (code === "escalonamento") {
        setViewTab("exits");
        return;
      }
      setViewTab("journey");
      setJourneyMode("active");
      const nodeId = stageNodeId(code);
      setTimeout(() => {
        void fitView({ nodes: [{ id: nodeId }], padding: 0.4, duration: 400 });
      }, 80);
    },
    [fitView]
  );

  useEffect(() => {
    if (!focusStage || viewTab !== "journey") return;
    const nodeId = stageNodeId(focusStage);
    const t = setTimeout(() => {
      void fitView({ nodes: [{ id: nodeId }], padding: 0.35, duration: 300 });
    }, 100);
    return () => clearTimeout(t);
  }, [focusStage, journeyMode, viewTab, fitView]);

  const { nodes, edges } = useMemo(() => {
    const graph = buildUnifiedGraph({ expandedStages, activeStage, parallelStages });
    const filtered = filterGraphForView(graph.nodes, graph.edges, {
      tab: viewTab,
      journeyMode,
      activeStage:
        focusStage && focusStage !== "escalonamento"
          ? focusStage
          : activeStage,
      parallelStages,
    });

    const scale = compact ? 0.55 : 1;
    const flowNodes: Node[] = [];
    const showEscalateBadge = viewTab === "journey";

    for (const n of filtered.nodes) {
      const pos = { x: n.position.x * scale, y: n.position.y * scale };

      if (n.kind === "swimlane") {
        flowNodes.push({
          id: n.id,
          type: "swimlane",
          position: pos,
          data: { label: n.label, width: (n.swimlaneWidth ?? 400) * scale, height: (n.swimlaneHeight ?? 120) * scale },
          draggable: false,
          selectable: false,
          zIndex: -2,
        });
        continue;
      }

      if (n.kind === "anchor") {
        flowNodes.push({ id: n.id, type: "anchor", position: pos, data: {}, selectable: false, zIndex: 0 });
        continue;
      }

      if (n.kind === "switch") {
        flowNodes.push({
          id: n.id,
          type: "switch",
          position: pos,
          data: {
            label: n.label,
            shortLabel: n.shortLabel,
            rules: n.switchRules,
            activeOutputIndex: activeStage
              ? n.switchRules?.findIndex((r) => r.targetStage === activeStage)
              : null,
            compact,
          },
          zIndex: 12,
        });
        continue;
      }

      if (n.kind === "runtime" || n.kind === "hub" || n.kind === "gate") {
        const isActive = highlight.activeRuntimeNodeIds.includes(n.id);
        flowNodes.push({
          id: n.id,
          type: n.kind === "hub" ? "hub" : n.kind === "gate" ? "gate" : "runtime",
          position: pos,
          data: { node: n, state: isActive ? "active" : "idle", compact },
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

        flowNodes.push({
          id: n.id,
          type: "stage",
          position: pos,
          data: {
            node: n,
            state,
            expanded: expandedStages.has(stageKey),
            toolCount: countToolsForStage(stageKey),
            compact,
            showEscalateBadge,
            onToggle: toggleStage,
          },
          zIndex: 8,
        });
        continue;
      }

      flowNodes.push({
        id: n.id,
        type: "tool",
        position: pos,
        data: {
          node: n,
          state: highlight.activeToolIds.includes(n.id) ? "active" : "idle",
          confirmMode: n.toolName && toolModes ? toolModes[n.toolName] : undefined,
          compact,
        },
        zIndex: 6,
      });
    }

    const flowEdges: Edge[] = filtered.edges.map((e) => {
      const style = EDGE_STYLES[e.kind];
      const isActive = highlight.activeEdgeIds.includes(e.id);
      const strokeColor = isActive ? "hsl(var(--primary))" : style.stroke;
      return {
        id: e.id,
        source: e.from,
        target: e.to,
        type: "orthogonal",
        animated: isActive,
        data: {
          routing: e.routing,
          triggerType: e.triggerType,
          label: e.label,
          highlighted: isActive,
          showLabelAlways: false,
        },
        style: {
          stroke: strokeColor,
          strokeWidth: isActive ? style.strokeWidth + 1 : style.strokeWidth,
          strokeDasharray: style.strokeDasharray,
        },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: strokeColor },
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
    viewTab,
    journeyMode,
    focusStage,
  ]);

  const detailStage = selectedStage ?? activeStage ?? null;
  const stepperStage = focusStage ?? activeStage ?? detailStage;

  const canvasInner = (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={{ type: "orthogonal", markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 } }}
      fitView
      fitViewOptions={{ padding: compact ? 0.12 : 0.18 }}
      minZoom={compact ? 0.05 : 0.08}
      maxZoom={compact ? 0.95 : 1.5}
      nodesDraggable={false}
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
    >
      <FitViewOnChange deps={[expandedStages, compact, viewTab, journeyMode, playbackIndex, nodes.length]} />
      <Background gap={compact ? 16 : 24} size={1} />
      {!compact && <Controls showInteractive={false} />}
      {!compact && <MiniMap zoomable pannable className="!bg-background/80" />}
    </ReactFlow>
  );

  const canvas = (
    <div className={cn("relative flex h-full w-full gap-0", className)}>
      <div className="relative min-w-0 flex-1 [&_.react-flow__edge-path]:stroke-[inherit]">
        <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-1 rounded-lg border bg-background/95 p-0.5 shadow-sm backdrop-blur-sm max-w-[calc(100%-1rem)]">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setViewTab(tab.id);
                if (tab.id !== "playback") setPlaybackPlaying(false);
                if (tab.id === "playback") setPlaybackIndex(0);
              }}
              className={cn(
                "rounded-md px-2 py-1 text-[9px] font-medium whitespace-nowrap",
                viewTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {viewTab === "journey" && !compact && (
          <div className="absolute left-2 right-2 top-10 z-10 flex flex-col gap-1.5">
            <StageStepper activeStage={stepperStage} onSelect={handleStepperSelect} />
            <div className="flex gap-1 self-start rounded-md border bg-background/95 p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setJourneyMode("active")}
                className={cn(
                  "rounded px-2 py-0.5 text-[9px] font-medium",
                  journeyMode === "active" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                Etapa ativa
              </button>
              <button
                type="button"
                onClick={() => setJourneyMode("full")}
                className={cn(
                  "rounded px-2 py-0.5 text-[9px] font-medium",
                  journeyMode === "full" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                Jornada completa
              </button>
            </div>
          </div>
        )}

        {viewTab === "playback" && !compact && (
          <div className="absolute left-2 top-10 z-10 flex max-w-[320px] items-start gap-2 rounded-lg border bg-background/95 p-2 shadow-sm backdrop-blur-sm">
            <div className="flex gap-1">
              <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => setPlaybackPlaying((p) => !p)}>
                {playbackPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-7 w-7"
                onClick={() => setPlaybackIndex((p) => (p + 1) % PLAYBACK_STEPS.length)}
              >
                <SkipForward className="h-3 w-3" />
              </Button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold">
                Passo {playbackIndex + 1}/{PLAYBACK_STEPS.length}
              </p>
              <p className="text-[9px] text-muted-foreground leading-snug">{highlight.playbackNarrative}</p>
            </div>
          </div>
        )}

        {showLegend && !compact && viewTab !== "journey" && (
          <div className="absolute left-2 bottom-2 z-10 max-w-[220px] rounded-lg border bg-background/95 p-2 text-[9px] shadow-sm backdrop-blur-sm">
            <p className="font-semibold mb-1">{FLOW_EXPLANATION.title}</p>
            <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground mb-2">
              {FLOW_EXPLANATION.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <ul className="space-y-0.5 text-muted-foreground border-t pt-1">
              {(Object.keys(EDGE_KIND_LABELS) as (keyof typeof EDGE_KIND_LABELS)[]).map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-4 shrink-0" style={{ background: EDGE_STYLES[k].stroke }} />
                  {EDGE_KIND_LABELS[k]}
                </li>
              ))}
            </ul>
          </div>
        )}

        {canvasInner}
      </div>

      {!compact && (
        <div className="w-[min(30%,280px)] shrink-0 border-l bg-muted/20 p-2 overflow-hidden flex flex-col">
          <StageDetailPanel
            stageCode={detailStage}
            parallelActive={parallelStages}
            onSelectStage={handleStepperSelect}
            className="flex-1 min-h-0"
          />
        </div>
      )}
    </div>
  );

  if (!showExpandButton) {
    return <div className={cn("h-full min-h-[180px] rounded-xl border bg-card overflow-hidden", className)}>{canvas}</div>;
  }

  return (
    <>
      <div className={cn("relative h-full min-h-[520px] rounded-2xl border bg-card overflow-hidden", className)}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-[min(30%,280px)] top-2 z-20 h-7 w-7 bg-background/70 backdrop-blur-sm mr-1"
          onClick={() => setExpanded(true)}
          aria-label="Expandir mapa"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        {canvas}
      </div>

      {expanded &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-sm" role="dialog" aria-modal>
            <div className="flex items-center justify-between border-b px-4 py-2">
              <div>
                <p className="text-sm font-semibold">Mapa do pipeline — swimlanes n8n</p>
                <p className="text-xs text-muted-foreground">Jornada CRM · Execução · Saídas · Passo a passo</p>
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
