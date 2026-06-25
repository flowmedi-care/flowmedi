import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/public-site/site-header";
import { SiteHero } from "@/components/public-site/site-hero";
import { SiteAbout } from "@/components/public-site/site-about";
import { SiteServices } from "@/components/public-site/site-services";
import { SiteTeam } from "@/components/public-site/site-team";
import { SiteLocation } from "@/components/public-site/site-location";
import { SiteFaq } from "@/components/public-site/site-faq";
import { SiteFooter } from "@/components/public-site/site-footer";
import { loadPublicClinicSite, getHeroTitle, getHeroSubtitle } from "@/lib/public-site/load-site";
import { RESERVED_CLINIC_SLUGS } from "@/lib/public-site/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (RESERVED_CLINIC_SLUGS.has(slug)) return { title: "Não encontrado" };

  const site = await loadPublicClinicSite(slug);
  if (!site.found) return { title: "Não encontrado" };

  const title = getHeroTitle(site);
  const description = getHeroSubtitle(site) ?? `Site de ${site.name}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(site.logo_url ? { images: [{ url: site.logo_url }] } : {}),
    },
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

  const primaryColor = site.site.primary_color;
  const style = primaryColor ? ({ "--primary": primaryColor } as Record<string, string>) : undefined;

  return (
    <div style={style}>
      <SiteHeader site={site} slug={slug} />
      <main>
        <SiteHero site={site} slug={slug} />
        <SiteAbout site={site} />
        <SiteServices site={site} />
        <SiteTeam site={site} />
        <SiteLocation site={site} />
        <SiteFaq site={site} />
      </main>
      <SiteFooter site={site} />
    </div>
  );
}
