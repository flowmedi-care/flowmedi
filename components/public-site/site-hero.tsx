import Link from "next/link";
import { LogoImage } from "@/components/logo-image";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, MessageCircle, Phone, Sparkles } from "lucide-react";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { getHeroSubtitle, getHeroTitle } from "@/lib/public-site/load-site";
import { checkPublicBookingReadiness } from "@/lib/public-site/booking-readiness";
import { getTodayHoursLabel } from "@/lib/public-site/presentation";

export function SiteHero({
  site,
  slug,
}: {
  site: PublicClinicSite;
  slug: string;
}) {
  const title = getHeroTitle(site);
  const subtitle =
    getHeroSubtitle(site) ??
    "Atendimento humanizado, profissionais qualificados e um ambiente pensado para o seu bem-estar.";
  const booking = checkPublicBookingReadiness(site);
  const todayHours = getTodayHoursLabel(site.operating_hours);
  const specialtyHint =
    site.doctors.length === 1 && site.doctors[0]?.specialty
      ? site.doctors[0].specialty
      : site.doctors.length > 1
        ? `${site.doctors.length} especialistas`
        : null;

  return (
    <section className="relative overflow-hidden bg-[#f7faf9]">
      {/* Decorative blobs */}
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -left-32 h-80 w-80 rounded-full bg-teal-200/30 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-emerald-100/40 blur-2xl pointer-events-none" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-12 pb-20 sm:pt-16 sm:pb-28">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
          {/* Copy */}
          <div className="text-center lg:text-left">
            {site.active_promotions && (
              <div className="inline-flex items-center gap-2 rounded-full bg-white border border-primary/20 px-4 py-1.5 text-sm text-primary font-medium shadow-sm mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                {site.active_promotions}
              </div>
            )}

            {!site.active_promotions && (
              <p className="text-sm font-medium text-primary mb-4 tracking-wide">
                Seu cuidado começa aqui
              </p>
            )}

            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-semibold tracking-tight text-[#1a2e28] leading-[1.1]">
              {title}
            </h1>

            <p className="mt-5 text-lg sm:text-xl text-[#5c6f68] leading-relaxed max-w-xl mx-auto lg:mx-0">
              {subtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3">
              {booking.available && (
                <Link href={`/c/${slug}/agendar`}>
                  <Button
                    size="lg"
                    className="rounded-full px-8 h-12 text-base shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Agendar consulta
                  </Button>
                </Link>
              )}
              {site.whatsapp_url && (
                <a href={site.whatsapp_url} target="_blank" rel="noopener noreferrer">
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full px-8 h-12 text-base border-[#25D366]/40 text-[#128C7E] hover:bg-[#25D366]/5 bg-white"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Falar no WhatsApp
                  </Button>
                </a>
              )}
            </div>

            {!booking.available && site.site.self_service_booking_enabled && booking.reason && (
              <p className="mt-6 text-sm text-amber-800 bg-amber-50 border border-amber-200/80 rounded-2xl px-4 py-3 max-w-lg mx-auto lg:mx-0">
                Agendamento online indisponível no momento. {booking.reason}
              </p>
            )}
          </div>

          {/* Visual card stack — cartão de visita */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="rounded-3xl bg-white shadow-xl shadow-[#1a2e28]/8 border border-[#e8efec] overflow-hidden">
              <div className="bg-gradient-to-br from-primary/90 to-teal-600 px-8 py-10 text-white text-center">
                {site.logo_url ? (
                  <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-2xl bg-white/95 p-4 shadow-lg">
                    <LogoImage
                      src={site.logo_url}
                      alt={site.name}
                      className="max-h-16 max-w-[200px] object-contain"
                      scale={site.logo_scale}
                    />
                  </div>
                ) : (
                  <div className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-semibold">
                    {site.name.charAt(0)}
                  </div>
                )}
                <p className="text-lg font-medium opacity-95">{site.name}</p>
                {specialtyHint && (
                  <p className="text-sm text-white/80 mt-1">{specialtyHint}</p>
                )}
              </div>

              <div className="p-6 space-y-4">
                {site.address && (
                  <div className="flex gap-3 text-sm">
                    <div className="shrink-0 h-9 w-9 rounded-xl bg-[#f0f5f3] flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-[#1a2e28]">Endereço</p>
                      <p className="text-[#5c6f68] mt-0.5 leading-snug">{site.address}</p>
                    </div>
                  </div>
                )}
                {todayHours && (
                  <div className="flex gap-3 text-sm">
                    <div className="shrink-0 h-9 w-9 rounded-xl bg-[#f0f5f3] flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-[#1a2e28]">Funcionamento</p>
                      <p className="text-[#5c6f68] mt-0.5">{todayHours}</p>
                    </div>
                  </div>
                )}
                {site.phone && (
                  <div className="flex gap-3 text-sm">
                    <div className="shrink-0 h-9 w-9 rounded-xl bg-[#f0f5f3] flex items-center justify-center">
                      <Phone className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-[#1a2e28]">Telefone</p>
                      <a
                        href={`tel:${site.phone.replace(/\D/g, "")}`}
                        className="text-primary hover:underline mt-0.5 inline-block"
                      >
                        {site.phone}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Floating badge */}
            {site.procedures.length > 0 && (
              <div className="absolute -bottom-4 -left-2 sm:-left-6 rounded-2xl bg-white px-4 py-3 shadow-lg border border-[#e8efec] text-sm">
                <span className="text-2xl font-semibold text-primary">{site.procedures.length}</span>
                <span className="text-[#5c6f68] ml-1.5">serviços</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
