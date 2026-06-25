import { LogoImage } from "@/components/logo-image";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { SiteSection, SiteSectionHeader } from "./site-section";

export function SiteTeam({ site }: { site: PublicClinicSite }) {
  if (!site.site.show_team || site.doctors.length === 0) return null;

  return (
    <SiteSection id="equipe">
      <SiteSectionHeader
        eyebrow="Nossa equipe"
        title="Profissionais que cuidam de você"
        description="Conheça quem vai te atender — experiência, empatia e dedicação em cada consulta."
        align="center"
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {site.doctors.map((doctor) => (
          <article
            key={doctor.id}
            className="group text-center rounded-3xl bg-white border border-[#e8efec] overflow-hidden hover:shadow-xl hover:shadow-[#1a2e28]/8 transition-all duration-300"
          >
            <div className="relative pt-8 pb-4 px-6 bg-gradient-to-b from-[#f0f5f3] to-white">
              {doctor.logo_url ? (
                <div className="mx-auto h-28 w-28 rounded-full overflow-hidden ring-4 ring-white shadow-lg">
                  <LogoImage
                    src={doctor.logo_url}
                    alt={doctor.full_name}
                    className="h-full w-full object-cover"
                    scale={doctor.logo_scale}
                  />
                </div>
              ) : (
                <div className="mx-auto h-28 w-28 rounded-full bg-gradient-to-br from-primary to-teal-600 flex items-center justify-center text-white text-3xl font-semibold ring-4 ring-white shadow-lg">
                  {doctor.full_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="px-6 pb-8">
              <h3 className="text-xl font-semibold text-[#1a2e28]">{doctor.full_name}</h3>
              {doctor.specialty && (
                <span className="inline-block mt-2 rounded-full bg-primary/10 text-primary text-sm font-medium px-4 py-1">
                  {doctor.specialty}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </SiteSection>
  );
}
