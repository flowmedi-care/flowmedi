"use client";

import Link from "next/link";
import { useState } from "react";
import { LogoImage } from "@/components/logo-image";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { checkPublicBookingReadiness } from "@/lib/public-site/booking-readiness";
import { getSegmentCopy } from "@/lib/public-site/presentation";
import { cn } from "@/lib/utils";

export function SiteHeader({
  site,
  slug,
}: {
  site: PublicClinicSite;
  slug: string;
}) {
  const booking = checkPublicBookingReadiness(site);
  const copy = getSegmentCopy(site.segment);
  const [open, setOpen] = useState(false);

  const links = [
    { href: "#sobre", label: "Sobre nós", show: true },
    {
      href: "#servicos",
      label: "Serviços",
      show: site.site.show_services && site.procedures.length > 0,
    },
    {
      href: "#equipe",
      label: "Equipe",
      show: site.site.show_team && site.doctors.length > 0,
    },
    { href: "#localizacao", label: "Onde estamos", show: true },
    { href: "#faq", label: "Dúvidas", show: site.site.show_faq && site.faq.length > 0 },
  ].filter((l) => l.show);

  return (
    <header className="sticky top-0 z-50 border-b border-[#e8efec]/80 bg-white/90 backdrop-blur-lg shadow-sm shadow-[#1a2e28]/[0.03]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href={`/c/${slug}`} className="flex items-center gap-3 min-w-0 shrink-0">
          {site.logo_url ? (
            <LogoImage
              src={site.logo_url}
              alt={site.name}
              className="max-h-10 max-w-[140px] object-contain"
              scale={Math.min(site.logo_scale, 120)}
            />
          ) : (
            <span className="font-semibold text-[#1a2e28] truncate">{site.name}</span>
          )}
        </Link>

        <nav className="hidden lg:flex items-center gap-8 text-sm text-[#5c6f68]">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hover:text-[#1a2e28] transition-colors font-medium"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {booking.available && (
            <Link href={`/c/${slug}/agendar`} className="hidden sm:block">
              <Button
                size="sm"
                className="rounded-full px-5 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 transition-shadow"
              >
                {copy.ctaLabel}
              </Button>
            </Link>
          )}
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg text-[#5c6f68] hover:bg-[#f0f5f3]"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-[#e8efec] bg-white px-4 py-4 space-y-1">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block py-2.5 px-3 rounded-xl text-[#1a2e28] font-medium hover:bg-[#f0f5f3]"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
          {booking.available && (
            <Link href={`/c/${slug}/agendar`} className="block pt-2" onClick={() => setOpen(false)}>
              <Button className="w-full rounded-full">Agendar consulta</Button>
            </Link>
          )}
        </div>
      )}
    </header>
  );
}

export function SiteMobileBar({
  site,
  slug,
}: {
  site: PublicClinicSite;
  slug: string;
}) {
  const booking = checkPublicBookingReadiness(site);
  if (!booking.available && !site.whatsapp_url) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "bg-gradient-to-t from-white via-white/95 to-transparent",
        "sm:hidden pointer-events-none"
      )}
    >
      <div className="flex gap-2 pointer-events-auto max-w-md mx-auto">
        {site.whatsapp_url && (
          <a
            href={site.whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 rounded-full bg-[#25D366] text-white font-medium py-3.5 text-sm shadow-lg"
          >
            WhatsApp
          </a>
        )}
        {booking.available && (
          <Link href={`/c/${slug}/agendar`} className="flex-1">
            <Button className="w-full rounded-full py-3.5 h-auto text-sm shadow-lg">Agendar</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
