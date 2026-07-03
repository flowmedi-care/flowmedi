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
import {
  AGENT_PIPELINE_FLOW_NODES,
  AGENT_PIPELINE_FLOW_EDGES,
} from "@/lib/virtual-assistant/agent-pipeline/flow-graph";
import type { AgentPipelineStage } from "@/lib/virtual-assistant/agent-pipeline/stages";
import type { ToolExecutionModesConfig } from "@/lib/virtual-assistant/agent-pipeline/confirmation-policy";
import { AgentPipelineNode, type AgentPipelineNodeData } from "./agent-pipeline-node";
import { cn } from "@/lib/utils";

type Props = {
  currentStage?: AgentPipelineStage | null;
  parallelStages?: AgentPipelineStage[];
  toolModes?: ToolExecutionModesConfig;
  className?: string;
  demoStage?: AgentPipelineStage | null;
};

const nodeTypes = { agentPipeline: AgentPipelineNode };

const POSITIONS: Record<string, { x: number; y: number }> = {
  identificacao: { x: 0, y: 120 },
  captacao: { x: 280, y: 120 },
  orcamento: { x: 560, y: 0 },
  agendamento: { x: 560, y: 240 },
  confirmacao_pre_consulta: { x: 840, y: 120 },
  pos_consulta: { x: 1120, y: 120 },
  satisfacao: { x: 1400, y: 120 },
  financeiro: { x: 560, y: 420 },
  formularios: { x: 840, y: 420 },
  escalonamento: { x: 280, y: 420 },
};

function resolveNodeState(
  nodeId: string,
  currentStage?: AgentPipelineStage | null,
  parallelStages: AgentPipelineStage[] = []
): AgentPipelineNodeData["state"] {
  const node = AGENT_PIPELINE_FLOW_NODES.find((n) => n.id === nodeId);
  if (!node) return "upcoming";
  if (nodeId === "escalonamento") return "transversal";
  if (nodeId === currentStage) return "current";
  if (parallelStages.includes(nodeId as AgentPipelineStage)) return "parallel";
  if (node.kind === "parallel") return "parallel";
  return "upcoming";
}

export function AgentPipelineCanvas({
  currentStage,
  parallelStages = [],
  toolModes,
  className,
  demoStage,
}: Props) {
  const activeStage = demoStage ?? currentStage;

  const { nodes, edges } = useMemo(() => {
    const flowNodes: Node<AgentPipelineNodeData>[] = AGENT_PIPELINE_FLOW_NODES.map((n) => ({
      id: n.id,
      type: "agentPipeline",
      position: POSITIONS[n.id] ?? { x: n.col * 280, y: n.row * 120 },
      data: {
        node: n,
        state: resolveNodeState(n.id, activeStage, parallelStages),
        toolModes,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }));

    const flowEdges: Edge[] = AGENT_PIPELINE_FLOW_EDGES.map((e, i) => ({
      id: `e-${i}`,
      source: e.from,
      target: e.to,
      label: e.label,
      animated: e.to === activeStage || e.from === activeStage,
      style: {
        stroke:
          e.kind === "transversal"
            ? "#ef4444"
            : e.kind === "parallel"
              ? "#94a3b8"
              : e.to === activeStage
                ? "hsl(var(--primary))"
                : "#64748b",
        strokeWidth: e.kind === "transversal" ? 2 : e.to === activeStage ? 2.5 : 1.5,
        strokeDasharray: e.kind !== "main" ? "6 4" : undefined,
      },
      labelStyle: { fontSize: 9, fill: "#64748b" },
      labelBgStyle: { fill: "hsl(var(--background))", fillOpacity: 0.85 },
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [activeStage, parallelStages, toolModes]);

  return (
    <div className={cn("h-full min-h-[520px] rounded-2xl border bg-card", className)}>
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">Pipeline do Agente</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Fluxo estilo n8n — etapas, ferramentas reais e transições. Pan/zoom para explorar.
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
          <span className="rounded-full border border-primary bg-primary/10 px-2 py-0.5">
            Etapa atual
          </span>
          <span className="rounded-full border border-dashed px-2 py-0.5 text-muted-foreground">
            Paralelo (financeiro, formulários)
          </span>
          <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-red-700">
            Transversal (transferir para humano)
          </span>
        </div>
        {activeStage && (
          <p className="mt-2 text-xs">
            Posição no fluxo:{" "}
            <strong>
              {AGENT_PIPELINE_FLOW_NODES.find((n) => n.id === activeStage)?.label ?? activeStage}
            </strong>
          </p>
        )}
      </div>
      <div className="h-[calc(100%-88px)] min-h-[432px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.25}
          maxZoom={1.2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} />
          <Controls showInteractive={false} />
          <MiniMap zoomable pannable className="!bg-background/80" />
        </ReactFlow>
      </div>
    </div>
  );
}
