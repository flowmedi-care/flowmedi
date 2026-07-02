import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { LogoImage } from "@/components/logo-image";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { checkPublicBookingReadiness } from "@/lib/public-site/booking-readiness";
import { getHeroImageUrl, getHeroSubtitle, getHeroTitle } from "@/lib/public-site/load-site";
import { getSegmentCopy } from "@/lib/public-site/presentation";
import { isOnClinicSubdomain, publicSiteBookingPath } from "@/lib/public-site/urls";
import { PremiumHeroImage } from "./premium-hero-image";

export async function PremiumHero({
  site,
  slug,
}: {
  site: PublicClinicSite;
  slug: string;
}) {
  const onClinicSubdomain = await isOnClinicSubdomain();
  const booking = checkPublicBookingReadiness(site);
  const copy = getSegmentCopy(site.segment);
  const title = getHeroTitle(site);
  const subtitle = getHeroSubtitle(site);
  const heroImage = getHeroImageUrl(site);
  const imageAlt = `${site.name} — atendimento em saúde`;

  return (
    <section id="inicio" className="relative pt-16 lg:pt-[4.5rem] overflow-hidden bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="order-2 lg:order-1">
            {site.logo_url ? (
              <div className="mb-6 inline-flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-[var(--site-bg)] px-5 py-4 shadow-sm">
                <LogoImage
                  src={site.logo_url}
                  alt={site.name}
                  className="max-h-14 sm:max-h-16 max-w-[200px] object-contain"
                  scale={Math.min(site.logo_scale, 130)}
                />
                <div className="hidden sm:block border-l border-slate-200 pl-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--site-primary)]">
                    {copy.heroEyebrow}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-[var(--site-text)]">{site.name}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm font-semibold uppercase tracking-wider text-[var(--site-primary)] mb-4">
                {copy.heroEyebrow}
              </p>
            )}

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
                  href={publicSiteBookingPath(slug, onClinicSubdomain)}
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
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-[var(--site-primary)]/15 bg-[var(--site-bg)] border border-slate-200/60">
              <PremiumHeroImage src={heroImage} alt={imageAlt} />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--site-primary)]/20 to-transparent pointer-events-none" />

              {site.logo_url && (
                <div className="absolute bottom-4 left-4 right-4 sm:right-auto flex items-center gap-3 rounded-xl bg-white/95 backdrop-blur-sm px-4 py-3 shadow-lg border border-white/80 max-w-xs">
                  <LogoImage
                    src={site.logo_url}
                    alt={site.name}
                    className="max-h-10 max-w-[120px] object-contain shrink-0"
                    scale={Math.min(site.logo_scale, 110)}
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--site-muted)]">Bem-vindo à</p>
                    <p className="font-semibold text-[var(--site-text)] truncate">{site.name}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-2xl bg-[var(--site-accent)]/20 blur-2xl -z-10" />
            <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full bg-[var(--site-primary)]/15 blur-2xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  );
}
