import { Accordion, AccordionItem } from "@/components/ui/accordion";
import type { PublicClinicSite } from "@/lib/public-site/types";

export function SiteFaq({ site }: { site: PublicClinicSite }) {
  if (!site.site.show_faq || site.faq.length === 0) return null;

  return (
    <section id="faq" className="py-16 px-4">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-2xl font-semibold mb-8 text-center">Perguntas frequentes</h2>
        <Accordion defaultOpenId={site.faq[0]?.id}>
          {site.faq.map((item) => (
            <AccordionItem key={item.id} id={item.id} question={item.question} answer={item.answer} />
          ))}
        </Accordion>
      </div>
    </section>
  );
}
