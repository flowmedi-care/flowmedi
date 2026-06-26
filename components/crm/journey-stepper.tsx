"use client";

import { cn } from "@/lib/utils";
import {
  JOURNEY_PHASE_LABELS,
  JOURNEY_STEPS,
  getStepDefinition,
  type JourneyStepCode,
} from "@/lib/contact-journey";

type JourneyStepperProps = {
  currentStep: JourneyStepCode;
  completedSteps: JourneyStepCode[];
  compact?: boolean;
};

export function JourneyStepper({ currentStep, completedSteps, compact }: JourneyStepperProps) {
  const completedSet = new Set(completedSteps);
  const currentOrder = getStepDefinition(currentStep).order;

  const phases = ["captacao", "pre_consulta", "consulta", "pos_consulta"] as const;

  return (
    <div className="space-y-6">
      {phases.map((phase) => {
        const phaseSteps = JOURNEY_STEPS.filter((s) => s.phase === phase);
        const phaseHasCurrent = phaseSteps.some((s) => s.code === currentStep);
        const phaseComplete = phaseSteps.every(
          (s) => completedSet.has(s.code) || s.order < currentOrder
        );

        return (
          <div key={phase}>
            <p
              className={cn(
                "text-xs font-semibold uppercase tracking-wide mb-3",
                phaseHasCurrent ? "text-primary" : phaseComplete ? "text-green-600" : "text-muted-foreground"
              )}
            >
              {JOURNEY_PHASE_LABELS[phase]}
            </p>
            <div className="flex flex-wrap gap-2">
              {phaseSteps.map((step) => {
                const isCurrent = step.code === currentStep;
                const isCompleted = completedSet.has(step.code) || step.order < currentOrder;
                const isUpcoming = step.order > currentOrder && !isCurrent;

                return (
                  <div
                    key={step.code}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                      isCurrent && "border-primary bg-primary/10 text-primary font-medium",
                      isCompleted && !isCurrent && "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
                      isUpcoming && "border-border bg-muted/30 text-muted-foreground",
                      compact && "px-2 py-1 text-xs"
                    )}
                    title={step.label}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                        isCurrent && "bg-primary text-primary-foreground",
                        isCompleted && !isCurrent && "bg-green-600 text-white",
                        isUpcoming && "bg-muted text-muted-foreground"
                      )}
                    >
                      {isCompleted && !isCurrent ? "✓" : step.order}
                    </span>
                    <span className={compact ? "hidden sm:inline" : ""}>{step.shortLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
