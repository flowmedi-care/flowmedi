import type { CSSProperties } from "react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SITE_THEME } from "@/lib/public-site/theme";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default function PublicSiteLayout({ children }: { children: ReactNode }) {
  return (
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
  );
}
