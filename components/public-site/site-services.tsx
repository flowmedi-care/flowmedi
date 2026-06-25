import type { PublicClinicSite } from "@/lib/public-site/types";
import { checkPublicBookingReadiness } from "@/lib/public-site/booking-readiness";
import { getSegmentCopy, getServiceGridClass } from "@/lib/public-site/presentation";
import { ServiceCard } from "./service-card";
import { SiteSection, SiteSectionHeader } from "./site-section";

export function SiteServices({
  site,
  slug,
}: {
  site: PublicClinicSite;
  slug: string;
}) {
  if (!site.site.show_services || site.procedures.length === 0) return null;

  const copy = getSegmentCopy(site.segment);
  const booking = checkPublicBookingReadiness(site);

  return (
    <SiteSection id="servicos" tinted>
      <SiteSectionHeader
        eyebrow={copy.servicesEyebrow}
        title={copy.servicesTitle}
        description={copy.servicesDescription}
        align="center"
      />

      <div className={getServiceGridClass(site.procedures.length)}>
        {site.procedures.map((proc) => (
          <ServiceCard
            key={proc.id}
            procedure={proc}
            slug={slug}
            actionLabel={copy.cardActionLabel}
            bookingAvailable={booking.available}
            whatsappUrl={site.whatsapp_url}
          />
        ))}
      </div>
    </SiteSection>
  );
}
