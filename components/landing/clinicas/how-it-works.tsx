"use client";

import { HOW_IT_WORKS } from "@/lib/landing/clinicas-content";
import { useTrackedSection } from "./use-tracked-section";

export function ClinicasHowItWorks() {
  const ref = useTrackedSection("how_it_works");

  return (
    <section
      id="como-funciona"
      ref={ref}
      className="border-b border-border/60 py-16 md:py-20"
    >
      <div className="container mx-auto px-4">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Como funciona
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
          Quatro passos. Sem textão.
        </p>

        <ol className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((item) => (
            <li key={item.step} className="text-center sm:text-left">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {item.step}
              </span>
              <h3 className="mt-3 text-base font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {item.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
