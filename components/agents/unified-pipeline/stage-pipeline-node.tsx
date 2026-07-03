"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnifiedGraphNode } from "@/lib/virtual-assistant/agent-pipeline/unified-flow-graph";

export type StagePipelineNodeData = {
  node: UnifiedGraphNode;
  state: "current" | "completed" | "upcoming" | "parallel" | "transversal";
  expanded: boolean;
  toolCount: number;
  compact?: boolean;
  onToggle?: (stageId: string) => void;
};

export function StagePipelineNode({ data }: { data: StagePipelineNodeData }) {
  const { node, state, expanded, toolCount, compact, onToggle } = data;
  const stageId = node.stageCode ?? "";

  return (
    <button
      type="button"
      onClick={() => onToggle?.(stageId)}
      className={cn(
        "rounded-lg border-2 bg-card shadow-sm text-left transition-all",
        compact ? "min-w-[88px] px-2 py-1.5" : "min-w-[120px] px-2.5 py-2",
        state === "current" && "border-primary ring-2 ring-primary/40 bg-primary/5",
        state === "parallel" && "border-dashed border-muted-foreground/50",
        state === "transversal" && "border-red-400 bg-red-50/60",
        state === "upcoming" && "border-border opacity-80",
        state === "completed" && "border-green-400/70",
        onToggle && "cursor-pointer hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className={cn("font-semibold leading-tight", compact ? "text-[9px]" : "text-[11px]")}>
            {compact ? node.shortLabel : node.label}
          </p>
          {!compact && node.crmPhase && (
            <p className="text-[9px] text-muted-foreground mt-0.5">{node.crmPhase}</p>
          )}
        </div>
        {toolCount > 0 && (
          <span className="shrink-0 text-muted-foreground">
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
        )}
      </div>
      {state === "current" && (
        <span className="mt-1 inline-block rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-medium text-primary-foreground">
          etapa atual
        </span>
      )}
      {toolCount > 0 && (
        <p className="text-[8px] text-muted-foreground mt-1">{toolCount} tools</p>
      )}
    </button>
  );
}
