"use client";

import {
  Bot,
  Calendar,
  MessageCircle,
  Receipt,
  Sparkles,
  Users,
} from "lucide-react";
import { PRODUCT_FLOW } from "@/lib/landing/clinicas-content";
import { useTrackedSection } from "./use-tracked-section";

const ICONS = {
  whatsapp: MessageCircle,
  ia: Bot,
  agenda: Calendar,
  crm: Users,
  financeiro: Receipt,
  pos: Sparkles,
} as const;

export function ClinicasProductFlow() {
  const ref = useTrackedSection("flow");

  return (
    <section
      ref={ref}
      className="border-b border-border/60 bg-muted/20 py-16 md:py-20"
    >
      <div className="container mx-auto px-4">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Do WhatsApp ao pós-consulta, em um fluxo só
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          O cérebro entende em segundos o que a plataforma organiza.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {PRODUCT_FLOW.map((item, i) => {
            const Icon = ICONS[item.id];
            return (
              <div
                key={item.id}
                className="relative flex flex-col items-start gap-2 rounded-xl border border-border/60 bg-background p-4"
              >
                {i < PRODUCT_FLOW.length - 1 && (
                  <span className="pointer-events-none absolute -right-2 top-1/2 z-10 hidden h-px w-4 -translate-y-1/2 bg-border lg:block" />
                )}
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
