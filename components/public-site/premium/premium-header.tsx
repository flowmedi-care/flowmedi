"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoImage } from "@/components/logo-image";
import { Menu, X } from "lucide-react";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { checkPublicBookingReadiness } from "@/lib/public-site/booking-readiness";
import { getSegmentCopy } from "@/lib/public-site/presentation";
import { usePublicSitePaths } from "@/components/public-site/public-site-path-context";
import { cn } from "@/lib/utils";

export function PremiumHeader({
  site,
  slug,
}: {
  site: PublicClinicSite;
  slug: string;
}) {
  const booking = checkPublicBookingReadiness(site);
  const copy = getSegmentCopy(site.segment);
  const { home, booking: bookingPath } = usePublicSitePaths();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#inicio", label: "Início", show: true },
    { href: "#sobre", label: "Sobre", show: true },
    {
      href: "#especialidades",
      label: "Especialidades",
      show: site.site.show_services && site.procedures.length > 0,
    },
    {
      href: "#equipe",
      label: "Corpo Clínico",
      show: site.site.show_team && site.doctors.length > 0,
    },
    { href: "#contato", label: "Contato", show: true },
  ].filter((l) => l.show);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/80"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 lg:h-[4.5rem] flex items-center justify-between gap-4">
        <Link href={home("#inicio")} className="flex items-center gap-3 min-w-0 shrink-0">
          {site.logo_url ? (
            <LogoImage
              src={site.logo_url}
              alt={site.name}
              className="max-h-10 max-w-[160px] object-contain"
              scale={Math.min(site.logo_scale, 120)}
            />
          ) : (
            <span
              className={cn(
                "font-bold text-lg truncate",
                scrolled ? "text-[var(--site-text)]" : "text-[var(--site-primary)]"
              )}
            >
              {site.name}
            </span>
          )}
        </Link>

        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-[var(--site-muted)]">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hover:text-[var(--site-primary)] transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {booking.available && (
            <Link href={bookingPath()} className="hidden sm:block">
              <span className="inline-flex items-center justify-center rounded-lg bg-[var(--site-accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/25 hover:brightness-105 transition-all">
                {copy.ctaLabel}
              </span>
            </Link>
          )}
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg text-[var(--site-muted)] hover:bg-slate-100"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-1 shadow-lg">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block py-2.5 px-3 rounded-lg text-[var(--site-text)] font-medium hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
          {booking.available && (
            <Link
              href={bookingPath()}
              className="block mt-2 text-center rounded-lg bg-[var(--site-accent)] px-4 py-3 text-sm font-semibold text-white"
              onClick={() => setOpen(false)}
            >
              {copy.ctaLabel}
            </Link>
          )}
        </div>
      )}
    </header>
  );
}

export function PremiumMobileBar({
  site,
  slug,
}: {
  site: PublicClinicSite;
  slug: string;
}) {
  const booking = checkPublicBookingReadiness(site);
  const copy = getSegmentCopy(site.segment);
  const { booking: bookingPath } = usePublicSitePaths();

  if (!booking.available && !site.whatsapp_url) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md p-3 flex gap-2">
      {site.whatsapp_url && (
        <a
          href={site.whatsapp_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center rounded-lg border border-[var(--site-primary)] py-3 text-sm font-semibold text-[var(--site-primary)]"
        >
          WhatsApp
        </a>
      )}
      {booking.available && (
        <Link
          href={bookingPath()}
          className="flex-1 text-center rounded-lg bg-[var(--site-accent)] py-3 text-sm font-semibold text-white shadow-md"
        >
          {copy.ctaLabel}
        </Link>
      )}
    </div>
  );
}
