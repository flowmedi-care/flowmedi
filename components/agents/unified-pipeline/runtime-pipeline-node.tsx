"use client";

import { Handle, Position } from "@xyflow/react";
import {
  Brain,
  ChatCircle,
  Database,
  GitBranch,
  TerminalWindow,
  Timer,
  CalendarCheck,
  ShieldCheck,
  PaperPlaneTilt,
  type Icon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { UnifiedGraphNode } from "@/lib/virtual-assistant/agent-pipeline/unified-flow-graph";

export type RuntimePipelineNodeData = {
  node: UnifiedGraphNode;
  state: "active" | "idle" | "upcoming";
  compact?: boolean;
};

const ICON_MAP: Record<NonNullable<UnifiedGraphNode["runtimeIcon"]>, Icon> = {
  message: ChatCircle,
  debounce: Timer,
  router: GitBranch,
  booking: CalendarCheck,
  agent: Brain,
  journey: Database,
  tools: TerminalWindow,
  response: PaperPlaneTilt,
  confirm: ShieldCheck,
  resolver: GitBranch,
};

const COLOR_MAP: Record<NonNullable<UnifiedGraphNode["runtimeIcon"]>, string> = {
  message: "border-cyan-400 bg-cyan-50 text-cyan-800",
  debounce: "border-slate-300 bg-slate-50 text-slate-700",
  router: "border-violet-400 bg-violet-50 text-violet-800",
  booking: "border-indigo-300 bg-indigo-50 text-indigo-800",
  agent: "border-violet-500 bg-violet-100 text-violet-900",
  journey: "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-800",
  tools: "border-emerald-400 bg-emerald-50 text-emerald-800",
  response: "border-amber-400 bg-amber-50 text-amber-800",
  confirm: "border-orange-300 bg-orange-50 text-orange-800",
  resolver: "border-purple-300 bg-purple-50 text-purple-800",
};

export function RuntimePipelineNode({ data }: { data: RuntimePipelineNodeData }) {
  const { node, state, compact } = data;
  const iconKey = node.runtimeIcon ?? "agent";
  const IconComp = ICON_MAP[iconKey];
  const colors = COLOR_MAP[iconKey];

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 shadow-sm flex flex-col items-center justify-center text-center",
        compact ? "min-w-[72px] px-1.5 py-1.5" : "min-w-[100px] px-2 py-2",
        colors,
        state === "active" && "ring-2 ring-primary ring-offset-1",
        state === "upcoming" && "opacity-70"
      )}
      title={node.description}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-slate-400" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-slate-400" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2 !h-2 !bg-slate-400" />
      <Handle type="target" position={Position.Top} id="top" className="!w-2 !h-2 !bg-slate-400" />
      <IconComp className={cn(compact ? "h-4 w-4" : "h-5 w-5")} weight="duotone" />
      <span className={cn("font-semibold mt-0.5 leading-tight", compact ? "text-[8px]" : "text-[10px]")}>
        {node.shortLabel ?? node.label}
      </span>
    </div>
  );
}
