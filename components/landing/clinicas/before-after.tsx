"use client";

import { Check, X } from "lucide-react";
import { AFTER_ITEMS, BEFORE_ITEMS } from "@/lib/landing/clinicas-content";
import { useTrackedSection } from "./use-tracked-section";

export function ClinicasBeforeAfter() {
  const ref = useTrackedSection("before_after");

  return (
    <section
      ref={ref}
      className="border-b border-border/60 bg-muted/20 py-16 md:py-20"
    >
      <div className="container mx-auto px-4">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          O que muda na rotina da clínica
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
          Menos improviso. Mais controle.
        </p>

        <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-background p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Antes
            </h3>
            <ul className="mt-4 space-y-3">
              {BEFORE_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
              Depois
            </h3>
            <ul className="mt-4 space-y-3">
              {AFTER_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
