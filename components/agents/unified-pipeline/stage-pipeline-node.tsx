"use client";

import { Handle, Position } from "@xyflow/react";
import { ChevronDown, ChevronRight, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnifiedGraphNode } from "@/lib/virtual-assistant/agent-pipeline/unified-flow-graph";

export type StageToolBadge = {
  name: string;
  label: string;
  mutating: boolean;
};

export type StagePipelineNodeData = {
  node: UnifiedGraphNode;
  state: "current" | "completed" | "upcoming" | "parallel" | "transversal";
  expanded: boolean;
  toolCount: number;
  tools?: StageToolBadge[];
  compact?: boolean;
  showEscalateBadge?: boolean;
  isGlobalOverlay?: boolean;
  onToggle?: (stageId: string) => void;
};

const MAX_INLINE_BADGES = 4;

export function StagePipelineNode({ data }: { data: StagePipelineNodeData }) {
  const {
    node,
    state,
    expanded,
    toolCount,
    tools = [],
    compact,
    showEscalateBadge,
    isGlobalOverlay,
    onToggle,
  } = data;
  const stageId = node.stageCode ?? "";
  const visibleTools = tools.slice(0, MAX_INLINE_BADGES);
  const extraCount = tools.length - visibleTools.length;

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 bg-card shadow-sm text-left transition-all",
        compact ? "min-w-[88px] px-2 py-1.5" : "min-w-[140px] max-w-[180px] px-2.5 py-2",
        state === "current" && "border-primary ring-2 ring-primary/40 bg-primary/5",
        state === "parallel" && "border-dashed border-muted-foreground/50",
        state === "transversal" && "border-red-400 bg-red-50/60",
        state === "upcoming" && "border-border opacity-90",
        state === "completed" && "border-green-400/70 bg-green-50/30"
      )}
    >
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-violet-500" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-violet-500" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2.5 !h-2.5 !bg-emerald-500" />
      <Handle type="target" position={Position.Top} id="top" className="!w-2.5 !h-2.5 !bg-fuchsia-500" />

      <button type="button" onClick={() => onToggle?.(stageId)} className="w-full text-left">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <p className={cn("font-semibold leading-tight", compact ? "text-[9px]" : "text-[11px]")}>
              {compact ? node.shortLabel : node.label}
            </p>
            {!compact && node.crmPhase && (
              <p className="text-[9px] text-muted-foreground mt-0.5">{node.crmPhase}</p>
            )}
          </div>
          {toolCount > 0 && (
            <span className="shrink-0 text-muted-foreground">
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </span>
          )}
        </div>

        {!compact && visibleTools.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-0.5">
            {visibleTools.map((t) => (
              <span
                key={t.name}
                title={t.name}
                className={cn(
                  "inline-block truncate max-w-[72px] rounded px-1 py-0.5 text-[7px] font-medium",
                  t.mutating
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {t.label}
              </span>
            ))}
            {extraCount > 0 && (
              <span className="inline-block rounded bg-muted px-1 py-0.5 text-[7px] text-muted-foreground">
                +{extraCount}
              </span>
            )}
          </div>
        )}

        <div className="mt-1 flex flex-wrap gap-0.5">
          {state === "current" && (
            <span className="inline-block rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-medium text-primary-foreground">
              aqui agora
            </span>
          )}
          {state === "completed" && (
            <span className="inline-block rounded-full bg-green-100 px-1.5 py-0.5 text-[8px] font-medium text-green-800">
              visitada
            </span>
          )}
          {isGlobalOverlay && (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[8px] font-medium text-slate-700">
              <Globe className="h-2.5 w-2.5" />
              global
            </span>
          )}
          {showEscalateBadge &&
            node.stageCode !== "escalonamento" &&
            node.stageCode !== "financeiro" &&
            node.stageCode !== "formularios" && (
              <span className="inline-block rounded-full border border-red-300 bg-red-50 px-1.5 py-0.5 text-[8px] font-medium text-red-700">
                Escalar
              </span>
            )}
        </div>

        {compact && toolCount > 0 && (
          <p className="text-[8px] text-muted-foreground mt-0.5">{toolCount} tools</p>
        )}
      </button>
    </div>
  );
}
