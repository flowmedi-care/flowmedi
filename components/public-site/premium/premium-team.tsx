import { LogoImage } from "@/components/logo-image";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { formatDoctorCrm } from "@/lib/public-site/theme";
import { truncateText } from "@/lib/public-site/presentation";
import { RevealSection } from "./reveal-section";

export function PremiumTeam({ site }: { site: PublicClinicSite }) {
  if (!site.site.show_team || site.doctors.length === 0) return null;

  return (
    <RevealSection id="equipe" className="py-16 lg:py-24 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--site-primary)] mb-2">
            Corpo clínico
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--site-text)]">
            Nossa equipe médica
          </h2>
          <p className="mt-4 text-[var(--site-muted)]">
            Profissionais dedicados ao seu cuidado e bem-estar.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {site.doctors.map((doctor) => {
            const crmLabel = formatDoctorCrm(doctor.crm, doctor.crm_uf);
            const bio = doctor.specialty ? truncateText(doctor.specialty, 120) : null;

            return (
              <article
                key={doctor.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 text-center hover:shadow-lg hover:border-[var(--site-primary)]/20 transition-all"
              >
                <div className="mx-auto w-28 h-28 rounded-full overflow-hidden bg-[var(--site-bg)] border-4 border-[var(--site-primary)]/10 flex items-center justify-center">
                  {doctor.logo_url ? (
                    <LogoImage
                      src={doctor.logo_url}
                      alt={doctor.full_name}
                      className="w-full h-full object-cover"
                      scale={doctor.logo_scale}
                    />
                  ) : (
                    <span className="text-3xl font-bold text-[var(--site-primary)]/40">
                      {doctor.full_name.charAt(0)}
                    </span>
                  )}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[var(--site-text)]">
                  {doctor.full_name}
                </h3>
                {doctor.specialty && (
                  <p className="mt-1 text-sm font-medium text-[var(--site-primary)]">
                    {doctor.specialty}
                  </p>
                )}
                {crmLabel && (
                  <p className="mt-1 text-xs text-[var(--site-muted)]">{crmLabel}</p>
                )}
                {bio && (
                  <p className="mt-3 text-sm text-[var(--site-muted)] leading-relaxed">{bio}</p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </RevealSection>
  );
}
