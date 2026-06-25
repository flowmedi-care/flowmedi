import Link from "next/link";
import { Calendar, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { checkPublicBookingReadiness } from "@/lib/public-site/booking-readiness";
import { getSegmentCopy, normalizeSegment } from "@/lib/public-site/presentation";

export function SiteCtaBand({
  site,
  slug,
}: {
  site: PublicClinicSite;
  slug: string;
}) {
  const booking = checkPublicBookingReadiness(site);
  const copy = getSegmentCopy(site.segment);
  if (!booking.available && !site.whatsapp_url && !site.phone) return null;

  return (
    <section className="relative overflow-hidden mx-4 sm:mx-6 mb-8 max-w-6xl lg:mx-auto rounded-3xl">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-teal-600 to-emerald-700" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-80" />
      <div className="relative px-8 py-14 sm:py-16 text-center text-white">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {normalizeSegment(site.segment) === "clinica"
            ? "Pronto para cuidar da sua saúde?"
            : "Fale conosco"}
        </h2>
        <p className="mt-3 text-white/85 text-lg max-w-lg mx-auto">
          {booking.available
            ? `${copy.ctaLabel} em poucos cliques ou entre em contato quando preferir.`
            : "Entre em contato — estamos prontos para ajudar."}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {booking.available && (
            <Link href={`/c/${slug}/agendar`}>
              <Button
                size="lg"
                className="rounded-full px-8 bg-white text-primary hover:bg-white/95 shadow-lg h-12"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {copy.ctaLabel}
              </Button>
            </Link>
          )}
          {site.whatsapp_url && (
            <a href={site.whatsapp_url} target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8 border-white/40 text-white hover:bg-white/10 bg-transparent h-12"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
            </a>
          )}
          {site.phone && (
            <a href={`tel:${site.phone.replace(/\D/g, "")}`}>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8 border-white/40 text-white hover:bg-white/10 bg-transparent h-12"
              >
                <Phone className="h-4 w-4 mr-2" />
                Ligar
              </Button>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
