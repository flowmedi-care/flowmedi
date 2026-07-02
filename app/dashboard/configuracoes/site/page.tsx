import { redirect } from "next/navigation";
import { getPublicSitePageData } from "./actions";
import { SiteConfigClient } from "./site-config-client";

export default async function ConfiguracoesSitePage() {
  const data = await getPublicSitePageData();
  if (data.error) redirect("/dashboard");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Site da clínica</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Landing page pública com informações da clínica e autoagendamento opcional.
        </p>
      </div>
      <SiteConfigClient
        initialSettings={data.settings ?? null}
        clinicName={data.clinicName ?? ""}
        slug={data.slug ?? ""}
        siteUrl={data.siteUrl ?? null}
        subdomainUrl={data.subdomainUrl ?? null}
        primarySiteUrl={data.primarySiteUrl ?? null}
        dataReadiness={
          data.dataReadiness ?? {
            ok: false,
            issues: [],
            stats: {
              procedures: 0,
              proceduresWithoutService: 0,
              services: 0,
              servicesWithoutPrice: 0,
              doctors: 0,
              doctorProcedureLinks: 0,
              dimensionsWithoutValues: 0,
            },
          }
        }
        bookingReadiness={
          data.bookingReadiness ?? { available: false, reason: null }
        }
        hasActiveRooms={data.hasActiveRooms ?? false}
      />
    </div>
  );
}
