import { Clock, Shield, Stethoscope, Users } from "lucide-react";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { getTodayHoursLabel } from "@/lib/public-site/presentation";

export function SiteTrustStrip({ site }: { site: PublicClinicSite }) {
  const todayHours = getTodayHoursLabel(site.operating_hours);
  const items = [
    site.doctors.length > 0 && {
      icon: Users,
      label: site.doctors.length === 1 ? "1 especialista" : `${site.doctors.length} especialistas`,
    },
    site.procedures.length > 0 && {
      icon: Stethoscope,
      label: `${site.procedures.length} procedimentos`,
    },
    todayHours && {
      icon: Clock,
      label: todayHours,
    },
    site.payment_methods.length > 0 && {
      icon: Shield,
      label: "Convênios e particular",
    },
  ].filter(Boolean) as { icon: typeof Users; label: string }[];

  if (items.length === 0) return null;

  return (
    <div className="border-y border-[#e8efec] bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-5">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {items.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 text-sm text-[#5c6f68]">
              <div className="h-8 w-8 rounded-full bg-[#f0f5f3] flex items-center justify-center">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <span className="font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
