import { Clock, HeartHandshake, Shield, Sparkles } from "lucide-react";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { getTodayHoursLabel } from "@/lib/public-site/presentation";

export function SiteTrustStrip({ site }: { site: PublicClinicSite }) {
  const todayHours = getTodayHoursLabel(site.operating_hours);

  const items = [
    { icon: HeartHandshake, label: "Atendimento humanizado" },
    { icon: Sparkles, label: "Profissionais qualificados" },
    todayHours && { icon: Clock, label: todayHours },
    site.payment_methods.length > 0 && {
      icon: Shield,
      label: site.payment_methods.slice(0, 2).join(" · ") || "Convênios e particular",
    },
  ].filter(Boolean) as { icon: typeof HeartHandshake; label: string }[];

  if (items.length === 0) return null;

  return (
    <div className="border-y border-[#e8efec] bg-[#fafcfb]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {items.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 text-sm text-[#5c6f68]">
              <Icon className="h-4 w-4 text-primary shrink-0" strokeWidth={1.75} />
              <span className="font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
