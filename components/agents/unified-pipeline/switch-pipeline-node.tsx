"use client";

import { Handle, Position } from "@xyflow/react";
import { GitBranch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { ResolverSwitchRule } from "@/lib/virtual-assistant/agent-pipeline/flow-model";

export type SwitchPipelineNodeData = {
  label: string;
  shortLabel?: string;
  rules?: ResolverSwitchRule[];
  activeOutputIndex?: number | null;
  compact?: boolean;
};

export function SwitchPipelineNode({ data }: { data: SwitchPipelineNodeData }) {
  const { label, shortLabel, rules = [], activeOutputIndex, compact } = data;
  const displayRules = compact ? rules.slice(0, 4) : rules.slice(0, 6);

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 border-indigo-500 bg-indigo-50/90 shadow-md",
        compact ? "min-w-[100px] px-2 py-2" : "min-w-[140px] px-2.5 py-2.5"
      )}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-indigo-500" />
      <Handle type="source" position={Position.Right} id="tools" className="!w-2 !h-2 !bg-emerald-500" />
      <Handle type="source" position={Position.Bottom} id="stages" className="!w-2 !h-2 !bg-violet-500" />

      <div className="flex items-center gap-1.5 mb-1.5">
        <GitBranch className="h-4 w-4 text-indigo-700" weight="duotone" />
        <span className={cn("font-bold text-indigo-900", compact ? "text-[9px]" : "text-[10px]")}>
          {shortLabel ?? label}
        </span>
      </div>

      <ul className="space-y-0.5 border-t border-indigo-200 pt-1">
        {displayRules.map((r, i) => (
          <li
            key={r.id}
            className={cn(
              "text-[7px] leading-tight truncate pl-1",
              activeOutputIndex === i ? "text-primary font-semibold" : "text-indigo-700/80"
            )}
          >
            {i + 1}. {r.label}
          </li>
        ))}
        {rules.length > displayRules.length && (
          <li className="text-[7px] text-muted-foreground pl-1">+{rules.length - displayRules.length} regras</li>
        )}
      </ul>
    </div>
  );
}
