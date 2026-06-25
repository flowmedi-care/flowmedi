import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Phone } from "lucide-react";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { DAY_LABELS } from "@/lib/public-site/types";
import type { DayKey } from "@/lib/virtual-assistant/types";

function formatHours(hours: PublicClinicSite["operating_hours"]) {
  const keys = Object.keys(DAY_LABELS) as DayKey[];
  return keys
    .map((key) => {
      const day = hours[key];
      if (!day || day.closed) return null;
      const open = day.open ?? "—";
      const close = day.close ?? "—";
      let line = `${DAY_LABELS[key]}: ${open} – ${close}`;
      if (day.lunch_start && day.lunch_end) {
        line += ` (almoço ${day.lunch_start}–${day.lunch_end})`;
      }
      return line;
    })
    .filter(Boolean);
}

export function SiteLocation({ site }: { site: PublicClinicSite }) {
  const hoursLines = formatHours(site.operating_hours);
  const hasLocations = site.locations.length > 0;
  const hasAddress = site.address || site.google_maps_url;

  if (!hasAddress && hoursLines.length === 0 && !hasLocations) return null;

  return (
    <section id="localizacao" className="py-16 px-4 bg-muted/30">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-semibold mb-8">Localização e horários</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {site.address && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Endereço
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {site.address}
                  {site.landmarks && (
                    <p className="mt-2 text-xs">Referência: {site.landmarks}</p>
                  )}
                  {site.google_maps_url && (
                    <a
                      href={site.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-sm text-primary hover:underline"
                    >
                      Ver no mapa
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
            {site.phone && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Telefone
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <a href={`tel:${site.phone.replace(/\D/g, "")}`} className="text-sm text-primary hover:underline">
                    {site.phone}
                  </a>
                </CardContent>
              </Card>
            )}
            {hasLocations &&
              site.locations.map((loc) => (
                <Card key={loc.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{loc.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-1">
                    {loc.address && <p>{loc.address}</p>}
                    {loc.phone && <p>{loc.phone}</p>}
                    {loc.google_maps_url && (
                      <a
                        href={loc.google_maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Ver no mapa
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
          {hoursLines.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Horário de funcionamento</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {hoursLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
