import { Accordion, AccordionItem } from "@/components/ui/accordion";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { RevealSection } from "./reveal-section";

export function PremiumFaq({ site }: { site: PublicClinicSite }) {
  if (!site.site.show_faq || site.faq.length === 0) return null;

  return (
    <RevealSection id="faq" className="py-16 lg:py-24 bg-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--site-primary)] mb-2">
            Dúvidas
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--site-text)]">
            Perguntas frequentes
          </h2>
        </div>

        <Accordion
          defaultOpenId={site.faq[0]?.id}
          className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white divide-slate-100"
        >
          {site.faq.map((item) => (
            <AccordionItem key={item.id} id={item.id} question={item.question} answer={item.answer} />
          ))}
        </Accordion>
      </div>
    </RevealSection>
  );
}
