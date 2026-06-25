import { Clock, Heart, Shield, Users } from "lucide-react";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { RevealSection } from "./reveal-section";

const PILLARS = [
  { icon: Heart, label: "Atendimento humanizado", desc: "Cuidado com empatia e respeito" },
  { icon: Shield, label: "Segurança e qualidade", desc: "Protocolos e boas práticas" },
  { icon: Users, label: "Equipe especializada", desc: "Profissionais qualificados" },
  { icon: Clock, label: "Horários flexíveis", desc: "Agendamento prático" },
];

export function PremiumStats({ site }: { site: PublicClinicSite }) {
  return (
    <RevealSection className="bg-[var(--site-bg)] border-y border-slate-200/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {PILLARS.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="text-center lg:text-left">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--site-primary)]/10 text-[var(--site-primary)] mb-3">
                <Icon className="h-6 w-6" strokeWidth={1.5} />
              </div>
              <h3 className="font-semibold text-[var(--site-text)] text-sm sm:text-base">{label}</h3>
              <p className="mt-1 text-xs sm:text-sm text-[var(--site-muted)]">{desc}</p>
            </div>
          ))}
        </div>
        {site.active_promotions && (
          <p className="mt-8 text-center text-sm font-medium text-[var(--site-primary)]">
            {site.active_promotions}
          </p>
        )}
      </div>
    </RevealSection>
  );
}
