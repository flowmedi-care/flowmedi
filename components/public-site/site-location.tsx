import { ExternalLink, Mail, MapPin, Navigation, Phone } from "lucide-react";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { formatHoursTable } from "@/lib/public-site/presentation";
import { SiteSection, SiteSectionHeader } from "./site-section";

export function SiteLocation({ site }: { site: PublicClinicSite }) {
  const hoursRows = formatHoursTable(site.operating_hours);
  const hasLocations = site.locations.length > 0;
  const hasAddress = site.address || site.google_maps_url;

  if (!hasAddress && hoursRows.length === 0 && !hasLocations && !site.phone && !site.email) {
    return null;
  }

  return (
    <SiteSection id="localizacao" tinted>
      <SiteSectionHeader
        eyebrow="Venha nos visitar"
        title="Onde estamos"
        description="Estamos prontos para receber você. Confira endereço, horários e como chegar."
      />

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Map / address block */}
        <div className="lg:col-span-3 space-y-4">
          {site.address && (
            <div className="rounded-3xl bg-white border border-[#e8efec] overflow-hidden shadow-sm">
              <div className="h-48 sm:h-56 bg-gradient-to-br from-[#e8f5f0] via-[#d4ebe3] to-[#c5e3d8] relative flex items-center justify-center">
                <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_50%,_white_0%,_transparent_50%)]" />
                <MapPin className="h-12 w-12 text-primary/60 relative" />
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="font-semibold text-lg text-[#1a2e28]">{site.name}</h3>
                <p className="mt-2 text-[#5c6f68] leading-relaxed">{site.address}</p>
                {site.landmarks && (
                  <p className="mt-2 text-sm text-[#5c6f68]/80">
                    <Navigation className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
                    {site.landmarks}
                  </p>
                )}
                {site.google_maps_url && (
                  <a
                    href={site.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    Abrir no Google Maps
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {hasLocations &&
            site.locations.map((loc) => (
              <div
                key={loc.id}
                className="rounded-2xl bg-white border border-[#e8efec] p-6"
              >
                <h3 className="font-semibold text-[#1a2e28]">{loc.name}</h3>
                {loc.address && <p className="mt-1 text-[#5c6f68]">{loc.address}</p>}
                {loc.phone && (
                  <a href={`tel:${loc.phone.replace(/\D/g, "")}`} className="text-primary text-sm mt-2 inline-block">
                    {loc.phone}
                  </a>
                )}
                {loc.google_maps_url && (
                  <a
                    href={loc.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm mt-2 block hover:underline"
                  >
                    Ver no mapa
                  </a>
                )}
              </div>
            ))}

          <div className="flex flex-wrap gap-4">
            {site.phone && (
              <a
                href={`tel:${site.phone.replace(/\D/g, "")}`}
                className="inline-flex items-center gap-3 rounded-2xl bg-white border border-[#e8efec] px-5 py-4 hover:border-primary/30 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-[#f0f5f3] flex items-center justify-center">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-[#5c6f68]">Telefone</p>
                  <p className="font-medium text-[#1a2e28]">{site.phone}</p>
                </div>
              </a>
            )}
            {site.email && (
              <a
                href={`mailto:${site.email}`}
                className="inline-flex items-center gap-3 rounded-2xl bg-white border border-[#e8efec] px-5 py-4 hover:border-primary/30 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-[#f0f5f3] flex items-center justify-center">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-[#5c6f68]">E-mail</p>
                  <p className="font-medium text-[#1a2e28]">{site.email}</p>
                </div>
              </a>
            )}
          </div>
        </div>

        {/* Hours */}
        {hoursRows.length > 0 && (
          <div className="lg:col-span-2">
            <div className="rounded-3xl bg-white border border-[#e8efec] p-6 sm:p-8 sticky top-24">
              <h3 className="font-semibold text-lg text-[#1a2e28] mb-6">Horários de atendimento</h3>
              <ul className="space-y-3">
                {hoursRows.map((row) => (
                  <li
                    key={row.label}
                    className={`flex justify-between gap-4 text-sm py-2 border-b border-[#f0f5f3] last:border-0 ${
                      row.isToday ? "font-semibold text-[#1a2e28]" : "text-[#5c6f68]"
                    }`}
                  >
                    <span>{row.label}{row.isToday ? " · hoje" : ""}</span>
                    <span className={row.closed ? "text-[#5c6f68]/60" : ""}>{row.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </SiteSection>
  );
}
