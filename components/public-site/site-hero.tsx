import Link from "next/link";
import { LogoImage } from "@/components/logo-image";
import { Button } from "@/components/ui/button";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { getHeroSubtitle, getHeroTitle } from "@/lib/public-site/load-site";
import { checkPublicBookingReadiness } from "@/lib/public-site/booking-readiness";

export function SiteHero({
  site,
  slug,
}: {
  site: PublicClinicSite;
  slug: string;
}) {
  const title = getHeroTitle(site);
  const subtitle = getHeroSubtitle(site);
  const booking = checkPublicBookingReadiness(site);

  return (
    <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 via-background to-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
      <div className="relative mx-auto max-w-5xl px-4 py-16 sm:py-24 text-center">
        {site.logo_url && (
          <div className="flex justify-center mb-8">
            <LogoImage
              src={site.logo_url}
              alt={site.name}
              className="max-h-20 max-w-[240px] object-contain"
              scale={site.logo_scale}
            />
          </div>
        )}
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && (
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {subtitle}
          </p>
        )}
        {site.active_promotions && (
          <p className="mt-4 inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary font-medium">
            {site.active_promotions}
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {booking.available && (
            <Link href={`/c/${slug}/agendar`}>
              <Button size="lg" className="min-w-[160px]">
                Agendar consulta
              </Button>
            </Link>
          )}
          {site.whatsapp_url && (
            <a href={site.whatsapp_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="lg">
                WhatsApp
              </Button>
            </a>
          )}
          {site.phone && (
            <a href={`tel:${site.phone.replace(/\D/g, "")}`}>
              <Button variant="outline" size="lg">
                Ligar
              </Button>
            </a>
          )}
        </div>
        {!booking.available && site.site.self_service_booking_enabled && booking.reason && (
          <p className="mt-6 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 max-w-xl mx-auto">
            Agendamento online indisponível no momento. {booking.reason}
          </p>
        )}
      </div>
    </section>
  );
}
