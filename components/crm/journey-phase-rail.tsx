"use client";

import { cn } from "@/lib/utils";
import { JOURNEY_PHASE_LABELS, JOURNEY_PHASE_ORDER } from "@/lib/contact-journey/steps";
import type { JourneyPhase } from "@/lib/contact-journey/types";
import { Check } from "lucide-react";

type JourneyPhaseRailProps = {
  currentPhase: JourneyPhase;
  completedPhases?: JourneyPhase[];
};

export function JourneyPhaseRail({ currentPhase, completedPhases = [] }: JourneyPhaseRailProps) {
  const completedSet = new Set(completedPhases);
  const currentIndex = JOURNEY_PHASE_ORDER.indexOf(currentPhase);

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-[640px] items-center gap-1">
        {JOURNEY_PHASE_ORDER.map((phase, index) => {
          const isCurrent = phase === currentPhase;
          const isCompleted = completedSet.has(phase) || index < currentIndex;

          return (
            <div key={phase} className="flex flex-1 items-center gap-1">
              <div
                className={cn(
                  "flex flex-1 flex-col items-center rounded-lg border px-2 py-2 text-center transition-colors",
                  isCurrent && "border-primary bg-primary/10 text-primary",
                  isCompleted && !isCurrent && "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300",
                  !isCurrent && !isCompleted && "border-border bg-muted/20 text-muted-foreground"
                )}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold mb-1">
                  {isCompleted && !isCurrent ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide leading-tight">
                  {JOURNEY_PHASE_LABELS[phase]}
                </span>
              </div>
              {index < JOURNEY_PHASE_ORDER.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-3 shrink-0 rounded",
                    index < currentIndex ? "bg-green-400" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
