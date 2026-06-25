import { Card, CardContent } from "@/components/ui/card";
import { LogoImage } from "@/components/logo-image";
import type { PublicClinicSite } from "@/lib/public-site/types";

export function SiteTeam({ site }: { site: PublicClinicSite }) {
  if (!site.site.show_team || site.doctors.length === 0) return null;

  return (
    <section id="equipe" className="py-16 px-4">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-semibold mb-2">Nossa equipe</h2>
        <p className="text-muted-foreground mb-8 text-sm">Profissionais que atendem na clínica</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {site.doctors.map((doctor) => (
            <Card key={doctor.id} className="overflow-hidden">
              <CardContent className="pt-6 flex flex-col items-center text-center">
                {doctor.logo_url ? (
                  <div className="mb-4 h-20 w-20 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                    <LogoImage
                      src={doctor.logo_url}
                      alt={doctor.full_name}
                      className="h-full w-full object-cover"
                      scale={doctor.logo_scale}
                    />
                  </div>
                ) : (
                  <div className="mb-4 h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-semibold">
                    {doctor.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <h3 className="font-medium">{doctor.full_name}</h3>
                {doctor.specialty && (
                  <p className="text-sm text-muted-foreground mt-1">{doctor.specialty}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
