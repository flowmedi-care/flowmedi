"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { DEMO_FEATURES } from "@/lib/landing/clinicas-content";
import { useClinicasAnalytics } from "./analytics-provider";
import { useTrackedSection } from "./use-tracked-section";

export function ClinicasDemo() {
  const { trackFeatureOpened } = useClinicasAnalytics();
  const ref = useTrackedSection("demo");
  const [active, setActive] = useState(0);
  const current = DEMO_FEATURES[active] ?? DEMO_FEATURES[0];

  return (
    <section
      id="demonstracao"
      ref={ref}
      className="border-b border-border/60 py-16 md:py-20"
    >
      <div className="container mx-auto px-4">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Veja o painel
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
          Prints reais do sistema — para você imaginar o dia a dia na clínica.
        </p>

        <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2">
          {DEMO_FEATURES.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActive(i);
                trackFeatureOpened(item.feature);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                i === active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {item.title}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="mx-auto mt-8 block max-w-4xl overflow-hidden rounded-xl border border-border/70 bg-card shadow-[var(--shadow-md)]"
          onClick={() => trackFeatureOpened(current.feature)}
        >
          <Image
            src={current.image}
            alt={`Tela FlowMed — ${current.title}`}
            width={1200}
            height={750}
            className="h-auto w-full object-cover object-top"
          />
        </button>
      </div>
    </section>
  );
}
