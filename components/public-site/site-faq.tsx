import { Accordion, AccordionItem } from "@/components/ui/accordion";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { SiteSection, SiteSectionHeader } from "./site-section";

export function SiteFaq({ site }: { site: PublicClinicSite }) {
  if (!site.site.show_faq || site.faq.length === 0) return null;

  return (
    <SiteSection id="faq">
      <SiteSectionHeader
        eyebrow="Tire suas dúvidas"
        title="Perguntas frequentes"
        description="Respostas rápidas sobre atendimento, agendamento e funcionamento da clínica."
        align="center"
      />

      <Accordion
        defaultOpenId={site.faq[0]?.id}
        className="max-w-2xl mx-auto border-[#e8efec] rounded-2xl overflow-hidden shadow-sm bg-white divide-[#f0f5f3]"
      >
        {site.faq.map((item) => (
          <AccordionItem key={item.id} id={item.id} question={item.question} answer={item.answer} />
        ))}
      </Accordion>
    </SiteSection>
  );
}
