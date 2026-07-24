import { Check } from "lucide-react";

const OUTCOMES = [
  "Organize atendimentos",
  "Automatize tarefas repetitivas",
  "Reduza faltas",
  "Centralize toda a operação",
  "Tenha IA ajudando sua equipe",
] as const;

export function PricingOutcomes() {
  return (
    <section className="mx-auto max-w-4xl text-center" aria-labelledby="pricing-outcomes-heading">
      <h2
        id="pricing-outcomes-heading"
        className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
      >
        O que a FlowMed resolve na sua clínica
      </h2>
      <p className="mt-2 text-sm text-muted-foreground sm:text-base">
        Resultados operacionais — não só uma lista de funcionalidades.
      </p>
      <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        {OUTCOMES.map((item) => (
          <li
            key={item}
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground/90 sm:text-[15px]"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-3 w-3 text-primary" strokeWidth={3} aria-hidden />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
