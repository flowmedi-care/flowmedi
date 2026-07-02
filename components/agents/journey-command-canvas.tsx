"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { JOURNEY_FLOW_EDGES, JOURNEY_FLOW_NODES } from "@/lib/contact-journey/flow-graph";
import { JOURNEY_PHASE_LABELS } from "@/lib/contact-journey";
import type { JourneyStepCode } from "@/lib/contact-journey";
import { cn } from "@/lib/utils";

type Props = {
  currentStep?: JourneyStepCode;
  completedSteps?: JourneyStepCode[];
  highlightStep?: JourneyStepCode | null;
  className?: string;
};

const PHASE_Y_OFFSET: Record<string, number> = {};
let phaseIndex = 0;
for (const n of JOURNEY_FLOW_NODES) {
  if (!(n.phase in PHASE_Y_OFFSET)) {
    PHASE_Y_OFFSET[n.phase] = phaseIndex * 180;
    phaseIndex++;
  }
}

function JourneyNode({
  data,
}: {
  data: { label: string; state: "current" | "completed" | "upcoming" | "highlight" };
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2 py-1.5 text-center text-[10px] font-medium shadow-sm min-w-[88px]",
        data.state === "current" && "border-primary bg-primary/15 text-primary ring-2 ring-primary/30",
        data.state === "highlight" && "border-amber-500 bg-amber-50 text-amber-800 animate-pulse",
        data.state === "completed" && "border-green-400 bg-green-50 text-green-800",
        data.state === "upcoming" && "border-border bg-muted/30 text-muted-foreground"
      )}
    >
      {data.label}
    </div>
  );
}

const nodeTypes = { journey: JourneyNode };

export function JourneyCommandCanvas({
  currentStep,
  completedSteps = [],
  highlightStep,
  className,
}: Props) {
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, Node>();

    for (const n of JOURNEY_FLOW_NODES) {
      const yBase = PHASE_Y_OFFSET[n.phase] ?? 0;
      let state: "current" | "completed" | "upcoming" | "highlight" = "upcoming";
      if (n.code === highlightStep) state = "highlight";
      else if (n.code === currentStep) state = "current";
      else if (completedSteps.includes(n.code)) state = "completed";

      nodeMap.set(n.code, {
        id: n.code,
        type: "journey",
        position: { x: n.col * 140 + 20, y: yBase + n.row * 56 },
        data: { label: n.shortLabel, state },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });
    }

    const flowEdges: Edge[] = JOURNEY_FLOW_EDGES.map((e, i) => ({
      id: `e-${i}`,
      source: e.from,
      target: e.to,
      animated: e.to === highlightStep || e.from === highlightStep,
      style: {
        stroke: e.to === highlightStep ? "#f59e0b" : "#94a3b8",
        strokeWidth: e.to === highlightStep ? 2.5 : 1,
      },
    }));

    return { nodes: [...nodeMap.values()], edges: flowEdges };
  }, [currentStep, completedSteps, highlightStep]);

  return (
    <div className={cn("h-full min-h-[420px] rounded-2xl border bg-card", className)}>
      <div className="border-b px-4 py-2">
        <p className="text-sm font-semibold">Mapa da Jornada</p>
        <p className="text-xs text-muted-foreground">
          Visualização estilo fluxo — pan/zoom para explorar todas as fases
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(JOURNEY_PHASE_LABELS).slice(0, 4).map(([k, v]) => (
            <span key={k} className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
              {v}
            </span>
          ))}
          <span className="text-[10px] text-muted-foreground">+ mais fases</span>
        </div>
      </div>
      <div className="h-[calc(100%-72px)] min-h-[348px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={false} />
          <MiniMap zoomable pannable className="!bg-background/80" />
        </ReactFlow>
      </div>
    </div>
  );
}
