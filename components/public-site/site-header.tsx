import Link from "next/link";
import { LogoImage } from "@/components/logo-image";
import { Button } from "@/components/ui/button";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { checkPublicBookingReadiness } from "@/lib/public-site/booking-readiness";

export function SiteHeader({
  site,
  slug,
}: {
  site: PublicClinicSite;
  slug: string;
}) {
  const booking = checkPublicBookingReadiness(site);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-4">
        <Link href={`/c/${slug}`} className="flex items-center gap-2 min-w-0">
          {site.logo_url ? (
            <LogoImage
              src={site.logo_url}
              alt={site.name}
              className="max-h-8 max-w-[120px] object-contain"
              scale={Math.min(site.logo_scale, 120)}
            />
          ) : (
            <span className="font-semibold truncate">{site.name}</span>
          )}
        </Link>
        <nav className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#sobre" className="hover:text-foreground transition-colors">
            Sobre
          </a>
          {site.site.show_services && site.procedures.length > 0 && (
            <a href="#servicos" className="hover:text-foreground transition-colors">
              Serviços
            </a>
          )}
          {site.site.show_team && site.doctors.length > 0 && (
            <a href="#equipe" className="hover:text-foreground transition-colors">
              Equipe
            </a>
          )}
          <a href="#localizacao" className="hover:text-foreground transition-colors">
            Contato
          </a>
        </nav>
        {booking.available && (
          <Link href={`/c/${slug}/agendar`}>
            <Button size="sm">Agendar</Button>
          </Link>
        )}
      </div>
    </header>
  );
}
