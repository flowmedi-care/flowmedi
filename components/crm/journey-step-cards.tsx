"use client";

import { cn } from "@/lib/utils";
import type { ActivePathStep } from "@/lib/contact-journey/types";
import { Clock } from "lucide-react";

type JourneyStepCardsProps = {
  steps: ActivePathStep[];
};

function StepCard({ step, index }: { step: ActivePathStep; index: number }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold border-2",
            step.status === "current" && "border-primary bg-primary text-primary-foreground",
            step.status === "completed" && "border-green-500 bg-green-500 text-white",
            step.status === "upcoming" && "border-muted-foreground/30 bg-muted text-muted-foreground",
            step.status === "skipped" && "border-dashed border-muted-foreground/20 text-muted-foreground/50"
          )}
        >
          {step.status === "completed" ? "✓" : index + 1}
        </div>
        {step.status !== "upcoming" && (
          <div className="w-px flex-1 min-h-4 bg-border mt-1" />
        )}
      </div>

      <div
        className={cn(
          "flex-1 rounded-lg border p-4 mb-3 transition-colors",
          step.status === "current" && "border-primary bg-primary/5 shadow-sm",
          step.status === "completed" && "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20",
          step.status === "upcoming" && "border-border bg-muted/10 opacity-70",
          step.status === "skipped" && "border-dashed opacity-50"
        )}
      >
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <p className="font-medium text-sm">{step.label}</p>
          {step.status === "current" && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
              Agora
            </span>
          )}
          {step.awaitsResponse && step.status === "current" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <Clock className="h-3 w-3" />
              Aguardando resposta
            </span>
          )}
        </div>
        {step.hint && step.status === "current" && (
          <p className="text-xs text-muted-foreground">{step.hint}</p>
        )}
        {step.status === "upcoming" && (
          <p className="text-xs text-muted-foreground">Próxima etapa do fluxo</p>
        )}
      </div>
    </div>
  );
}

export function JourneyStepCards({ steps }: JourneyStepCardsProps) {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">Nenhuma etapa no caminho ativo.</p>
    );
  }

  return (
    <div className="space-y-0">
      {steps.map((step, index) => (
        <StepCard key={step.code} step={step} index={index} />
      ))}
    </div>
  );
}
