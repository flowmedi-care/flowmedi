import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { checkPublicBookingReadiness } from "@/lib/public-site/booking-readiness";
import { getHeroImageUrl, getHeroSubtitle, getHeroTitle } from "@/lib/public-site/load-site";
import { getSegmentCopy } from "@/lib/public-site/presentation";

export function PremiumHero({
  site,
  slug,
}: {
  site: PublicClinicSite;
  slug: string;
}) {
  const booking = checkPublicBookingReadiness(site);
  const copy = getSegmentCopy(site.segment);
  const title = getHeroTitle(site);
  const subtitle = getHeroSubtitle(site);
  const heroImage = getHeroImageUrl(site);

  return (
    <section id="inicio" className="relative pt-16 lg:pt-[4.5rem] overflow-hidden bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="order-2 lg:order-1">
            <p className="text-sm font-semibold uppercase tracking-wider text-[var(--site-primary)] mb-4">
              {copy.heroEyebrow}
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--site-text)] leading-tight tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-5 text-lg text-[var(--site-muted)] leading-relaxed max-w-xl">
                {subtitle}
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              {booking.available && (
                <Link
                  href={`/c/${slug}/agendar`}
                  className="inline-flex items-center justify-center rounded-lg bg-[var(--site-accent)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:brightness-105 transition-all"
                >
                  {copy.ctaLabel}
                </Link>
              )}
              {site.whatsapp_url && (
                <a
                  href={site.whatsapp_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-[var(--site-primary)] px-6 py-3 text-sm font-semibold text-[var(--site-primary)] hover:bg-[var(--site-primary)]/5 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              )}
            </div>
          </div>

          <div className="order-1 lg:order-2 relative">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl shadow-[var(--site-primary)]/15">
              {heroImage.startsWith("http") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={heroImage}
                  alt={`${site.name} — atendimento em saúde`}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <Image
                  src={heroImage}
                  alt={`${site.name} — atendimento em saúde`}
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--site-primary)]/30 via-transparent to-transparent" />
            </div>
            <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-2xl bg-[var(--site-accent)]/20 blur-2xl -z-10" />
            <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full bg-[var(--site-primary)]/15 blur-2xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  );
}
