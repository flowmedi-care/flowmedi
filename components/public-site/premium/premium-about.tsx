import { Cpu, HeartHandshake, Sofa, Users } from "lucide-react";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { RevealSection } from "./reveal-section";

const DIFFERENTIALS = [
  { icon: HeartHandshake, title: "Atendimento humanizado", desc: "Escuta ativa e acolhimento em cada consulta." },
  { icon: Cpu, title: "Equipamentos modernos", desc: "Tecnologia de ponta para diagnósticos precisos." },
  { icon: Users, title: "Equipe especializada", desc: "Profissionais com formação e experiência comprovada." },
  { icon: Sofa, title: "Ambiente confortável", desc: "Espaço pensado para seu bem-estar e tranquilidade." },
];

export function PremiumAbout({ site }: { site: PublicClinicSite }) {
  const hasStory = Boolean(site.short_description?.trim());
  const hasMission = Boolean(site.site.mission?.trim());
  const hasVision = Boolean(site.site.vision?.trim());
  const hasValues = Boolean(site.site.values_text?.trim());
  const hasMvv = hasMission || hasVision || hasValues;

  return (
    <RevealSection id="sobre" className="py-16 lg:py-24 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--site-primary)] mb-2">
            Sobre nós
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--site-text)]">
            Conheça a {site.name}
          </h2>
        </div>

        <div className={hasStory || hasMvv ? "grid lg:grid-cols-2 gap-10 lg:gap-16 mb-16" : "mb-16"}>
          {hasStory && (
            <div>
              <h3 className="text-lg font-semibold text-[var(--site-text)] mb-4">Nossa história</h3>
              <p className="text-[var(--site-muted)] leading-relaxed whitespace-pre-line">
                {site.short_description}
              </p>
            </div>
          )}

          {(hasMission || hasVision || hasValues) && (
            <div className="space-y-4">
              {hasMission && (
                <div className="rounded-xl border border-slate-200 bg-[var(--site-bg)] p-5">
                  <h4 className="font-semibold text-[var(--site-primary)] mb-2">Missão</h4>
                  <p className="text-sm text-[var(--site-muted)] leading-relaxed whitespace-pre-line">
                    {site.site.mission}
                  </p>
                </div>
              )}
              {hasVision && (
                <div className="rounded-xl border border-slate-200 bg-[var(--site-bg)] p-5">
                  <h4 className="font-semibold text-[var(--site-primary)] mb-2">Visão</h4>
                  <p className="text-sm text-[var(--site-muted)] leading-relaxed whitespace-pre-line">
                    {site.site.vision}
                  </p>
                </div>
              )}
              {hasValues && (
                <div className="rounded-xl border border-slate-200 bg-[var(--site-bg)] p-5">
                  <h4 className="font-semibold text-[var(--site-primary)] mb-2">Valores</h4>
                  <p className="text-sm text-[var(--site-muted)] leading-relaxed whitespace-pre-line">
                    {site.site.values_text}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {DIFFERENTIALS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex gap-4 rounded-xl border border-slate-200 p-5 hover:border-[var(--site-primary)]/30 hover:shadow-md transition-all"
            >
              <div className="shrink-0 w-11 h-11 rounded-lg bg-[var(--site-primary)]/10 flex items-center justify-center text-[var(--site-primary)]">
                <Icon className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="font-semibold text-[var(--site-text)]">{title}</h4>
                <p className="mt-1 text-sm text-[var(--site-muted)]">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </RevealSection>
  );
}
