"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type BreadcrumbStep = {
  key: string;
  label: string;
  value?: string;
  done: boolean;
};

export function BookingBreadcrumb({ steps }: { steps: BreadcrumbStep[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1">
          {i > 0 && <span className="text-muted-foreground/50">›</span>}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
              step.done ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            {step.done && <Check className="h-3 w-3" />}
            <span className="font-medium">{step.label}</span>
            {step.value && (
              <span className={cn(step.done ? "text-primary/80" : "text-muted-foreground")}>
                {step.value}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
