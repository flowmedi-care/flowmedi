"use client";

import { cn } from "@/lib/utils";
import {
  ASSISTANT_TOOL_CATEGORY_LABELS,
  type AssistantToolCategory,
} from "@/lib/virtual-assistant/tools/catalog";
import type { AgentPipelineFlowNode } from "@/lib/virtual-assistant/agent-pipeline/flow-graph";
import type { ToolExecutionMode } from "@/lib/virtual-assistant/agent-pipeline/confirmation-policy";

export type AgentPipelineNodeData = {
  node: AgentPipelineFlowNode;
  state: "current" | "completed" | "upcoming" | "parallel" | "transversal";
  toolModes?: Record<string, ToolExecutionMode>;
};

const CATEGORY_COLORS: Record<AssistantToolCategory, string> = {
  paciente: "bg-blue-100 text-blue-800 border-blue-200",
  agendamento: "bg-violet-100 text-violet-800 border-violet-200",
  precos: "bg-cyan-100 text-cyan-800 border-cyan-200",
  comercial: "bg-amber-100 text-amber-800 border-amber-200",
  crm: "bg-emerald-100 text-emerald-800 border-emerald-200",
  formulario: "bg-indigo-100 text-indigo-800 border-indigo-200",
  financeiro: "bg-red-100 text-red-800 border-red-200",
  atendimento: "bg-rose-100 text-rose-800 border-rose-200",
};

export function AgentPipelineNode({ data }: { data: AgentPipelineNodeData }) {
  const { node, state, toolModes } = data;
  const toolsByCategory = node.tools.reduce<
    Record<string, typeof node.tools>
  >((acc, tool) => {
    const cat = tool.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tool);
    return acc;
  }, {});

  return (
    <div
      className={cn(
        "min-w-[200px] max-w-[240px] rounded-xl border-2 bg-card shadow-md overflow-hidden",
        state === "current" && "border-primary ring-2 ring-primary/40",
        state === "completed" && "border-green-400/80",
        state === "parallel" && "border-dashed border-muted-foreground/40",
        state === "transversal" && "border-red-400 bg-red-50/50",
        state === "upcoming" && "border-border"
      )}
    >
      <div
        className={cn(
          "px-3 py-2 border-b",
          state === "current" && "bg-primary/10",
          state === "transversal" && "bg-red-100/80",
          state === "parallel" && "bg-muted/40"
        )}
      >
        <p className="text-xs font-semibold leading-tight">{node.label}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{node.crmPhase}</p>
        {state === "current" && (
          <span className="inline-block mt-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-medium text-primary-foreground">
            Etapa atual
          </span>
        )}
      </div>
      <div className="px-2 py-2 space-y-1.5 max-h-[180px] overflow-y-auto">
        {Object.entries(toolsByCategory).map(([cat, tools]) => (
          <div key={cat}>
            <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
              {ASSISTANT_TOOL_CATEGORY_LABELS[cat as AssistantToolCategory] ?? cat}
            </p>
            <div className="flex flex-wrap gap-0.5">
              {tools.map((tool) => {
                const mode = toolModes?.[tool.name];
                return (
                  <span
                    key={tool.name}
                    title={tool.name}
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded border px-1 py-0.5 text-[9px] font-medium",
                      CATEGORY_COLORS[tool.category as AssistantToolCategory] ??
                        "bg-muted text-muted-foreground"
                    )}
                  >
                    {tool.label}
                    {tool.mutating && (
                      <span className="opacity-60" title="Mutável">
                        ✎
                      </span>
                    )}
                    {mode === "human_confirm" && (
                      <span className="text-[8px] opacity-70" title="Confirmação humana">
                        ?
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
