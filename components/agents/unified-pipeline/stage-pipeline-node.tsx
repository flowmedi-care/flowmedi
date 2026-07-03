"use client";

import { Handle, Position } from "@xyflow/react";
import { ChevronRight, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { PIPELINE_THEME } from "@/lib/virtual-assistant/agent-pipeline/pipeline-theme";
import type { UnifiedGraphNode } from "@/lib/virtual-assistant/agent-pipeline/unified-flow-graph";

export type StageToolBadge = {
  name: string;
  label: string;
  mutating: boolean;
};

export type StagePipelineNodeData = {
  node: UnifiedGraphNode;
  state: "current" | "completed" | "upcoming" | "parallel" | "transversal";
  toolCount: number;
  tools?: StageToolBadge[];
  compact?: boolean;
  isGlobalOverlay?: boolean;
  onToggle?: (stageId: string) => void;
};

export function StagePipelineNode({ data }: { data: StagePipelineNodeData }) {
  const { node, state, toolCount, compact, isGlobalOverlay, onToggle } = data;
  const stageId = node.stageCode ?? "";

  const stageClass =
    state === "current"
      ? PIPELINE_THEME.stage.current
      : state === "completed"
        ? PIPELINE_THEME.stage.visited
        : state === "transversal" || isGlobalOverlay
          ? PIPELINE_THEME.stage.transversal
          : state === "parallel"
            ? PIPELINE_THEME.stage.parallel
            : PIPELINE_THEME.stage.neutral;

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 shadow-sm text-left transition-all",
        compact ? "min-w-[88px] px-2 py-1.5" : "min-w-[140px] max-w-[180px] px-2.5 py-2",
        stageClass,
        state === "upcoming" && "opacity-90"
      )}
    >
      <Handle type="target" position={Position.Left} className={PIPELINE_THEME.handle} />
      <Handle type="source" position={Position.Right} className={PIPELINE_THEME.handle} />

      <button type="button" onClick={() => onToggle?.(stageId)} className="w-full text-left">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            {isGlobalOverlay && (
              <span className="mb-0.5 inline-flex items-center gap-0.5 text-[8px] font-medium text-red-700/80">
                <Globe className="h-2.5 w-2.5" />
                global
              </span>
            )}
            <p className={cn("font-semibold leading-tight", compact ? "text-[9px]" : "text-[11px]")}>
              {compact ? node.shortLabel : node.label}
            </p>
          </div>
        </div>

        {state === "current" && (
          <p className="mt-1 text-[8px] font-medium text-primary">aqui agora</p>
        )}

        {!compact && toolCount > 0 && (
          <p className="mt-1 flex items-center gap-0.5 text-[9px] text-muted-foreground">
            {toolCount} {toolCount === 1 ? "ferramenta" : "ferramentas"}
            <ChevronRight className="h-3 w-3 shrink-0" />
          </p>
        )}

        {compact && toolCount > 0 && (
          <p className="text-[8px] text-muted-foreground mt-0.5">{toolCount} tools</p>
        )}
      </button>
    </div>
  );
}
