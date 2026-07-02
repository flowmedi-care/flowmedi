import type { CSSProperties } from "react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { PublicSitePathProvider } from "@/components/public-site/public-site-path-context";
import { extractClinicSubdomain } from "@/lib/public-site/host";
import { SITE_THEME } from "@/lib/public-site/theme";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

type Props = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

export default async function PublicSiteLayout({ children, params }: Props) {
  const { slug } = await params;
  const headersList = await headers();
  const onClinicSubdomain = !!extractClinicSubdomain(headersList.get("host") ?? "");

  return (
    <PublicSitePathProvider slug={slug} onClinicSubdomain={onClinicSubdomain}>
      <div
        className="min-h-screen bg-[var(--site-bg)] text-[var(--site-text)]"
        style={
          {
            "--site-primary": SITE_THEME.primary,
            "--site-accent": SITE_THEME.accent,
            "--site-bg": SITE_THEME.background,
            "--site-text": SITE_THEME.text,
            "--site-muted": SITE_THEME.muted,
          } as CSSProperties
        }
      >
        {children}
      </div>
    </PublicSitePathProvider>
  );
}
