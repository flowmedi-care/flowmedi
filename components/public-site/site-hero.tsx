import Link from "next/link";
import { LogoImage } from "@/components/logo-image";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, MessageCircle, Phone, Sparkles } from "lucide-react";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { getHeroSubtitle, getHeroTitle } from "@/lib/public-site/load-site";
import { checkPublicBookingReadiness } from "@/lib/public-site/booking-readiness";
import { getSegmentCopy, getTodayHoursLabel } from "@/lib/public-site/presentation";
import { isOnClinicSubdomain, publicSiteBookingPath } from "@/lib/public-site/urls";

export async function SiteHero({
  site,
  slug,
}: {
  site: PublicClinicSite;
  slug: string;
}) {
  const onClinicSubdomain = await isOnClinicSubdomain();
  const copy = getSegmentCopy(site.segment);
  const title = getHeroTitle(site);
  const subtitle = getHeroSubtitle(site) ?? copy.heroSubtitleFallback;
  const booking = checkPublicBookingReadiness(site);
  const todayHours = getTodayHoursLabel(site.operating_hours);

  const cardTagline =
    site.doctors.length === 1 && site.doctors[0]?.specialty
      ? site.doctors[0].specialty
      : site.short_description
        ? truncateShort(site.short_description)
        : null;

  return (
    <section className="relative overflow-hidden bg-white border-b border-[#e8efec]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#f7faf9] via-white to-[#f0f7f4] pointer-events-none" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-14 pb-16 sm:pt-20 sm:pb-24">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-20 items-center">
          <div className="text-center lg:text-left">
            {site.active_promotions ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/15 px-4 py-1.5 text-sm text-primary font-medium mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                {site.active_promotions}
              </div>
            ) : (
              <p className="text-sm font-medium text-primary mb-4 tracking-wide uppercase">
                {copy.heroEyebrow}
              </p>
            )}

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold tracking-tight text-[#1a2e28] leading-[1.08]">
              {title}
            </h1>

            <p className="mt-5 text-lg sm:text-xl text-[#5c6f68] leading-relaxed max-w-xl mx-auto lg:mx-0">
              {subtitle}
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center lg:justify-start gap-3">
              {booking.available && (
                <Link href={publicSiteBookingPath(slug, onClinicSubdomain)}>
                  <Button
                    size="lg"
                    className="rounded-full px-8 h-12 text-base shadow-md shadow-primary/20"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    {copy.ctaLabel}
                  </Button>
                </Link>
              )}
              {site.whatsapp_url && (
                <a href={site.whatsapp_url} target="_blank" rel="noopener noreferrer">
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full px-8 h-12 text-base border-[#e8efec] bg-white hover:bg-[#f7faf9]"
                  >
                    <MessageCircle className="h-4 w-4 mr-2 text-[#128C7E]" />
                    WhatsApp
                  </Button>
                </a>
              )}
            </div>

            {!booking.available && site.site.self_service_booking_enabled && booking.reason && (
              <p className="mt-6 text-sm text-amber-800 bg-amber-50 border border-amber-200/80 rounded-xl px-4 py-3 max-w-lg mx-auto lg:mx-0">
                Agendamento online indisponível. {booking.reason}
              </p>
            )}
          </div>

          <div className="mx-auto w-full max-w-md lg:max-w-none">
            <div className="rounded-2xl bg-white shadow-lg shadow-[#1a2e28]/5 border border-[#e8efec] overflow-hidden">
              <div className="px-6 py-8 border-b border-[#f0f5f3] text-center bg-[#fafcfb]">
                {site.logo_url ? (
                  <LogoImage
                    src={site.logo_url}
                    alt={site.name}
                    className="mx-auto max-h-14 max-w-[180px] object-contain"
                    scale={site.logo_scale}
                  />
                ) : (
                  <div className="mx-auto h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center text-xl font-semibold text-primary">
                    {site.name.charAt(0)}
                  </div>
                )}
                <p className="mt-4 font-semibold text-[#1a2e28]">{site.name}</p>
                {cardTagline && (
                  <p className="text-sm text-[#5c6f68] mt-1 leading-snug">{cardTagline}</p>
                )}
              </div>

              <div className="p-6 space-y-4">
                {site.address && (
                  <div className="flex gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-[#1a2e28]">Endereço</p>
                      <p className="text-[#5c6f68] mt-0.5 leading-snug">{site.address}</p>
                    </div>
                  </div>
                )}
                {todayHours && (
                  <div className="flex gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-[#1a2e28]">Funcionamento</p>
                      <p className="text-[#5c6f68] mt-0.5">{todayHours}</p>
                    </div>
                  </div>
                )}
                {site.phone && (
                  <div className="flex gap-3 text-sm">
                    <Phone className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-[#1a2e28]">Telefone</p>
                      <a
                        href={`tel:${site.phone.replace(/\D/g, "")}`}
                        className="text-primary hover:underline mt-0.5 inline-block"
                      >
                        {site.phone}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function truncateShort(text: string, max = 60): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}
