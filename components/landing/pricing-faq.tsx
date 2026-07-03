import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { PRICING_FAQ } from "@/lib/landing/content";
import { PublicSectionHeader } from "@/components/landing/public-section-header";

export function PricingFaq() {
  return (
    <section className="py-16 md:py-20">
      <div className="container mx-auto px-4">
        <PublicSectionHeader
          title="Perguntas frequentes"
          description="Tire suas dúvidas sobre planos e assinatura."
          className="mb-10"
        />
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card overflow-hidden shadow-elevated">
          <Accordion defaultOpenId={PRICING_FAQ[0].id}>
            {PRICING_FAQ.map((item) => (
              <AccordionItem
                key={item.id}
                id={item.id}
                question={item.question}
                answer={item.answer}
              />
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
