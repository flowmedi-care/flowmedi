import { LogoImage } from "@/components/logo-image";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { getSegmentCopy } from "@/lib/public-site/presentation";
import { SiteSection, SiteSectionHeader } from "./site-section";

export function SiteTeam({ site }: { site: PublicClinicSite }) {
  if (!site.site.show_team || site.doctors.length === 0) return null;

  const copy = getSegmentCopy(site.segment);

  return (
    <SiteSection id="equipe">
      <SiteSectionHeader
        eyebrow={copy.teamEyebrow}
        title={copy.teamTitle}
        description={copy.teamDescription}
        align="center"
      />

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
        {site.doctors.map((doctor) => (
          <article
            key={doctor.id}
            className="text-center group"
          >
            {doctor.logo_url ? (
              <div className="mx-auto h-32 w-32 rounded-full overflow-hidden ring-1 ring-[#e8efec] shadow-md group-hover:shadow-lg transition-shadow">
                <LogoImage
                  src={doctor.logo_url}
                  alt={doctor.full_name}
                  className="h-full w-full object-cover"
                  scale={doctor.logo_scale}
                />
              </div>
            ) : (
              <div className="mx-auto h-32 w-32 rounded-full bg-[#f0f5f3] border border-[#e8efec] flex items-center justify-center text-2xl font-semibold text-primary">
                {doctor.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            <h3 className="mt-5 text-lg font-semibold text-[#1a2e28]">{doctor.full_name}</h3>
            {doctor.specialty && (
              <p className="mt-1.5 text-sm text-[#5c6f68]">{doctor.specialty}</p>
            )}
          </article>
        ))}
      </div>
    </SiteSection>
  );
}
