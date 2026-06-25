import type { PublicClinicSite } from "@/lib/public-site/types";
import { checkPublicBookingReadiness } from "@/lib/public-site/booking-readiness";
import { getSegmentCopy, getServiceGridClass } from "@/lib/public-site/presentation";
import { ServiceCard } from "@/components/public-site/service-card";
import { RevealSection } from "./reveal-section";

export function PremiumSpecialties({
  site,
  slug,
}: {
  site: PublicClinicSite;
  slug: string;
}) {
  if (!site.site.show_services || site.procedures.length === 0) return null;

  const booking = checkPublicBookingReadiness(site);
  const copy = getSegmentCopy(site.segment);

  return (
    <RevealSection id="especialidades" className="py-16 lg:py-24 bg-[var(--site-bg)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--site-primary)] mb-2">
            {copy.servicesEyebrow}
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--site-text)]">
            Nossas especialidades
          </h2>
          <p className="mt-4 text-[var(--site-muted)]">{copy.servicesDescription}</p>
        </div>

        <div className={`${getServiceGridClass(site.procedures.length)} items-stretch`}>
          {site.procedures.map((procedure) => (
            <ServiceCard
              key={procedure.id}
              procedure={procedure}
              slug={slug}
              actionLabel={copy.cardActionLabel}
              bookingAvailable={booking.available}
              whatsappUrl={site.whatsapp_url}
            />
          ))}
        </div>
      </div>
    </RevealSection>
  );
}
