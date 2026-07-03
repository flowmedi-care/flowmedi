"use client";

import { cn } from "@/lib/utils";
import {
  ASSISTANT_TOOL_CATEGORY_LABELS,
  type AssistantToolCategory,
} from "@/lib/virtual-assistant/tools/catalog";
import type { ToolExecutionMode } from "@/lib/virtual-assistant/agent-pipeline/confirmation-policy";
import type { UnifiedGraphNode } from "@/lib/virtual-assistant/agent-pipeline/unified-flow-graph";

export type ToolPipelineNodeData = {
  node: UnifiedGraphNode;
  state: "active" | "idle" | "upcoming";
  confirmMode?: ToolExecutionMode;
  compact?: boolean;
};

const CATEGORY_DOT: Record<AssistantToolCategory, string> = {
  paciente: "bg-blue-500",
  agendamento: "bg-violet-500",
  precos: "bg-cyan-500",
  comercial: "bg-amber-500",
  crm: "bg-emerald-500",
  formulario: "bg-indigo-500",
  financeiro: "bg-red-500",
  atendimento: "bg-rose-500",
};

export function ToolPipelineNode({ data }: { data: ToolPipelineNodeData }) {
  const { node, state, confirmMode, compact } = data;
  const cat = (node.toolCategory ?? "crm") as AssistantToolCategory;
  const dot = CATEGORY_DOT[cat] ?? "bg-muted";

  return (
    <div
      className={cn(
        "rounded-md border bg-background shadow-sm",
        compact ? "px-1.5 py-1 min-w-[80px]" : "px-2 py-1.5 min-w-[96px]",
        state === "active" && "border-amber-500 ring-1 ring-amber-400/50",
        state === "upcoming" && "opacity-60"
      )}
      title={node.toolName}
    >
      <div className="flex items-center gap-1">
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dot)} />
        <span className={cn("font-medium leading-tight truncate", compact ? "text-[8px]" : "text-[9px]")}>
          {node.label}
        </span>
      </div>
      {!compact && (
        <p className="text-[7px] text-muted-foreground mt-0.5 pl-2.5 truncate">
          {ASSISTANT_TOOL_CATEGORY_LABELS[cat]}
          {node.mutating ? " · mutável" : ""}
          {confirmMode === "human_confirm" ? " · confirma?" : ""}
        </p>
      )}
    </div>
  );
}
