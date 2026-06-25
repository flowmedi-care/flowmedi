import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import type { PublicClinicSite } from "@/lib/public-site/types";

export function SiteServices({ site }: { site: PublicClinicSite }) {
  if (!site.site.show_services || site.procedures.length === 0) return null;

  return (
    <section id="servicos" className="py-16 px-4 bg-muted/30">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-semibold mb-2">Serviços</h2>
        <p className="text-muted-foreground mb-8 text-sm">
          Procedimentos disponíveis na clínica
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {site.procedures.map((proc) => (
            <Card key={proc.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{proc.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>{proc.duration_minutes} min</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
