import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingWizard } from "@/components/public-site/booking-wizard";
import { PremiumHeader } from "@/components/public-site/premium/premium-header";
import { PremiumFooter } from "@/components/public-site/premium/premium-footer";
import { loadPublicClinicSite } from "@/lib/public-site/load-site";
import { getPreferredPublicSiteUrl } from "@/lib/public-site/urls";
import { checkPublicBookingReadiness } from "@/lib/public-site/booking-readiness";
import { getSegmentCopy } from "@/lib/public-site/presentation";
import { RESERVED_CLINIC_SLUGS } from "@/lib/public-site/types";
import { siteThemeCssVars } from "@/lib/public-site/theme";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const site = await loadPublicClinicSite(slug);
  if (!site.found) return { title: "Agendar" };
  const copy = getSegmentCopy(site.segment);
  const canonicalUrl = `${getPreferredPublicSiteUrl(slug)}/agendar`;
  return {
    title: `${copy.ctaLabel} — ${site.name}`,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${copy.ctaLabel} — ${site.name}`,
      url: canonicalUrl,
      type: "website",
    },
  };
}

function BookingWizardFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--site-primary)]" />
    </div>
  );
}

export default async function PublicBookingPage({ params }: Props) {
  const { slug } = await params;

  if (RESERVED_CLINIC_SLUGS.has(slug)) {
    notFound();
  }

  const site = await loadPublicClinicSite(slug);
  if (!site.found) {
    notFound();
  }

  const readiness = checkPublicBookingReadiness(site);
  if (!readiness.available) {
    notFound();
  }

  const copy = getSegmentCopy(site.segment);
  const themeVars = siteThemeCssVars({ primary: site.site.primary_color });

  return (
    <div style={themeVars}>
      <PremiumHeader site={site} slug={slug} />
      <div className="pt-16 lg:pt-[4.5rem] min-h-screen bg-[var(--site-bg)]">
        <div className="py-10 sm:py-14 px-4 sm:px-6">
          <div className="mx-auto max-w-lg text-center mb-10">
            <p className="text-sm font-semibold uppercase tracking-wider text-[var(--site-primary)] mb-2">
              Agendamento online
            </p>
            <h1 className="text-3xl font-bold text-[var(--site-text)] tracking-tight sm:text-4xl">
              {copy.ctaLabel}
            </h1>
            <p className="text-[var(--site-muted)] mt-2">{site.name}</p>
          </div>
          <div className="mx-auto max-w-xl">
            <Suspense fallback={<BookingWizardFallback />}>
              <BookingWizard slug={slug} clinicName={site.name} />
            </Suspense>
          </div>
        </div>
      </div>
      <PremiumFooter site={site} />
    </div>
  );
}
