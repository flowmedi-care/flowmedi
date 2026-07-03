"use client";

import { cn } from "@/lib/utils";
import type { AgentPipelineStage } from "@/lib/virtual-assistant/agent-pipeline/stages";
import { PIPELINE_STAGE_STEPPER } from "@/lib/virtual-assistant/agent-pipeline/view-filter";

type Props = {
  activeStage?: AgentPipelineStage | "escalonamento" | null;
  visitedStages?: AgentPipelineStage[];
  onSelect: (code: AgentPipelineStage | "escalonamento") => void;
  className?: string;
};

export function StageStepper({ activeStage, visitedStages = [], onSelect, className }: Props) {
  const visitedSet = new Set(visitedStages);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-lg border bg-background/95 px-2 py-1.5 shadow-sm backdrop-blur-sm",
        className
      )}
    >
      {PIPELINE_STAGE_STEPPER.map((s, i) => {
        const isActive = activeStage === s.code;
        const isVisited = !isActive && visitedSet.has(s.code as AgentPipelineStage);
        return (
          <span key={s.code} className="flex items-center gap-1">
            {i > 0 && <span className="text-[8px] text-muted-foreground/60">→</span>}
            <button
              type="button"
              onClick={() => onSelect(s.code)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[9px] font-medium transition-colors",
                isActive && "bg-primary text-primary-foreground",
                isVisited && "bg-green-100 text-green-800 border border-green-200",
                !isActive &&
                  !isVisited &&
                  "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                s.code === "escalonamento" && !isActive && !isVisited && "border border-red-200 text-red-700"
              )}
            >
              {s.shortLabel}
            </button>
          </span>
        );
      })}
    </div>
  );
}
