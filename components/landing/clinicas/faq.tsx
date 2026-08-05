"use client";

import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { CLINICAS_FAQ } from "@/lib/landing/clinicas-content";
import { useClinicasAnalytics } from "./analytics-provider";
import { useTrackedSection } from "./use-tracked-section";

export function ClinicasFaq() {
  const { trackFaqOpened } = useClinicasAnalytics();
  const ref = useTrackedSection("faq");

  return (
    <section
      id="faq"
      ref={ref}
      className="border-b border-border/60 py-16 md:py-20"
    >
      <div className="container mx-auto max-w-2xl px-4">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Perguntas frequentes
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
          Dúvidas reais de quem já conversou conosco.
        </p>

        <Accordion
          className="mt-10 overflow-hidden rounded-xl border border-border/60 bg-background"
          onOpenChange={(id) => {
            if (!id) return;
            const item = CLINICAS_FAQ.find((f) => f.question === id);
            if (item) trackFaqOpened(item.question);
          }}
        >
          {CLINICAS_FAQ.map((item) => (
            <AccordionItem
              key={item.question}
              id={item.question}
              question={item.question}
              answer={item.answer}
            />
          ))}
        </Accordion>
      </div>
    </section>
  );
}
