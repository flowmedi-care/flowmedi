import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicClinicSite } from "@/lib/public-site/types";

export function SiteAbout({ site }: { site: PublicClinicSite }) {
  const hasContent =
    site.short_description ||
    site.payment_methods.length > 0 ||
    site.cancellation_policy ||
    site.parking_info ||
    site.accessibility_info;

  if (!hasContent) return null;

  return (
    <section id="sobre" className="py-16 px-4">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-semibold mb-8">Sobre a clínica</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {site.short_description && (
            <Card className="sm:col-span-2">
              <CardContent className="pt-6 text-muted-foreground leading-relaxed">
                {site.short_description}
              </CardContent>
            </Card>
          )}
          {site.payment_methods.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Formas de pagamento</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {site.payment_methods.join(" · ")}
              </CardContent>
            </Card>
          )}
          {site.cancellation_policy && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Política de cancelamento</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
                {site.cancellation_policy}
              </CardContent>
            </Card>
          )}
          {site.parking_info && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Estacionamento</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{site.parking_info}</CardContent>
            </Card>
          )}
          {site.accessibility_info && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Acessibilidade</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{site.accessibility_info}</CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
