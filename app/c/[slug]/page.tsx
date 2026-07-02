import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PremiumHeader, PremiumMobileBar } from "@/components/public-site/premium/premium-header";
import { PremiumHero } from "@/components/public-site/premium/premium-hero";
import { PremiumStats } from "@/components/public-site/premium/premium-stats";
import { PremiumAbout } from "@/components/public-site/premium/premium-about";
import { PremiumSpecialties } from "@/components/public-site/premium/premium-specialties";
import { PremiumTeam } from "@/components/public-site/premium/premium-team";
import { PremiumFaq } from "@/components/public-site/premium/premium-faq";
import { PremiumContact } from "@/components/public-site/premium/premium-contact";
import { PremiumCta } from "@/components/public-site/premium/premium-cta";
import { PremiumFooter } from "@/components/public-site/premium/premium-footer";
import {
  loadPublicClinicSite,
  getHeroTitle,
  getHeroSubtitle,
} from "@/lib/public-site/load-site";
import { getPreferredPublicSiteUrl } from "@/lib/public-site/urls";
import { RESERVED_CLINIC_SLUGS } from "@/lib/public-site/types";
import { siteThemeCssVars } from "@/lib/public-site/theme";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (RESERVED_CLINIC_SLUGS.has(slug)) return { title: "Não encontrado" };

  const site = await loadPublicClinicSite(slug);
  if (!site.found) return { title: "Não encontrado" };

  const title = `${getHeroTitle(site)} | ${site.name}`;
  const description = getHeroSubtitle(site) ?? `Site de ${site.name}`;

  const canonicalUrl = getPreferredPublicSiteUrl(slug);

  return {
    title,
    description,
    keywords: [
      site.name,
      "clínica",
      "consulta",
      "agendamento",
      ...(site.procedures.slice(0, 5).map((p) => p.name) ?? []),
    ],
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonicalUrl,
      siteName: site.name,
      locale: "pt_BR",
      ...(site.logo_url ? { images: [{ url: site.logo_url, alt: site.name }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(site.logo_url ? { images: [site.logo_url] } : {}),
    },
  };
}

function buildJsonLd(
  site: Awaited<ReturnType<typeof loadPublicClinicSite>> & { found: true }
) {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    name: site.name,
    url: getPreferredPublicSiteUrl(site.slug),
    ...(site.logo_url ? { image: site.logo_url } : {}),
    ...(site.phone ? { telephone: site.phone } : {}),
    ...(site.email ? { email: site.email } : {}),
    ...(site.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: site.address,
            addressCountry: "BR",
          },
        }
      : {}),
    ...(site.google_maps_url ? { hasMap: site.google_maps_url } : {}),
  };
}

export default async function PublicClinicSitePage({ params }: Props) {
  const { slug } = await params;

  if (RESERVED_CLINIC_SLUGS.has(slug)) {
    notFound();
  }

  const site = await loadPublicClinicSite(slug);
  if (!site.found) {
    notFound();
  }

  const themeVars = siteThemeCssVars({
    primary: site.site.primary_color,
  });

  const jsonLd = buildJsonLd(site);

  return (
    <div style={themeVars} className="pb-20 sm:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PremiumHeader site={site} slug={slug} />
      <main>
        <PremiumHero site={site} slug={slug} />
        <PremiumStats site={site} />
        <PremiumAbout site={site} />
        <PremiumSpecialties site={site} slug={slug} />
        <PremiumTeam site={site} />
        <PremiumFaq site={site} />
        <PremiumContact site={site} slug={slug} />
        <PremiumCta site={site} slug={slug} />
      </main>
      <PremiumFooter site={site} />
      <PremiumMobileBar site={site} slug={slug} />
    </div>
  );
}
