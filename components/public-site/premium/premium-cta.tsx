import Link from "next/link";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { checkPublicBookingReadiness } from "@/lib/public-site/booking-readiness";
import { getSegmentCopy } from "@/lib/public-site/presentation";
import { RevealSection } from "./reveal-section";

export function PremiumCta({
  site,
  slug,
}: {
  site: PublicClinicSite;
  slug: string;
}) {
  const booking = checkPublicBookingReadiness(site);
  const copy = getSegmentCopy(site.segment);

  if (!booking.available && !site.whatsapp_url) return null;

  return (
    <RevealSection className="py-16 lg:py-20 bg-[var(--site-primary)]">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
          Agende sua consulta hoje mesmo
        </h2>
        <p className="mt-4 text-lg text-white/85 max-w-2xl mx-auto">
          Cuidar da saúde é prioridade. Escolha o horário que melhor se encaixa na sua rotina.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          {booking.available && (
            <Link
              href={`/c/${slug}/agendar`}
              className="inline-flex items-center justify-center rounded-lg bg-[var(--site-accent)] px-8 py-3.5 text-sm font-semibold text-white shadow-lg hover:brightness-105 transition-all"
            >
              {copy.ctaLabel}
            </Link>
          )}
          {site.whatsapp_url && (
            <a
              href={site.whatsapp_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg border-2 border-white/80 px-8 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Falar no WhatsApp
            </a>
          )}
        </div>
      </div>
    </RevealSection>
  );
}
