import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { serviceEmoji } from "@/lib/public-site/presentation";
import { checkPublicBookingReadiness } from "@/lib/public-site/booking-readiness";
import { SiteSection, SiteSectionHeader } from "./site-section";

export function SiteServices({
  site,
  slug,
}: {
  site: PublicClinicSite;
  slug: string;
}) {
  if (!site.site.show_services || site.procedures.length === 0) return null;

  const booking = checkPublicBookingReadiness(site);

  return (
    <SiteSection id="servicos" tinted>
      <SiteSectionHeader
        eyebrow="O que fazemos"
        title="Serviços e procedimentos"
        description="Atendimentos disponíveis na clínica. Escolha o que precisa e agende no horário que funciona para você."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {site.procedures.map((proc, i) => (
          <article
            key={proc.id}
            className="group relative rounded-2xl bg-white border border-[#e8efec] p-6 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
          >
            <div className="text-3xl mb-4" aria-hidden>
              {serviceEmoji(i)}
            </div>
            <h3 className="text-lg font-semibold text-[#1a2e28] group-hover:text-primary transition-colors">
              {proc.name}
            </h3>
            <div className="mt-3 flex items-center gap-2 text-sm text-[#5c6f68]">
              <Clock className="h-4 w-4 text-primary/70" />
              <span>Cerca de {proc.duration_minutes} min</span>
            </div>
          </article>
        ))}
      </div>

      {booking.available && (
        <div className="mt-12 text-center">
          <Link href={`/c/${slug}/agendar`}>
            <Button size="lg" className="rounded-full px-8">
              Quero agendar
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      )}
    </SiteSection>
  );
}
