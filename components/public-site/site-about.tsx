import { Accessibility, Car, CreditCard, HeartHandshake } from "lucide-react";
import type { PublicClinicSite } from "@/lib/public-site/types";
import { SiteSection, SiteSectionHeader } from "./site-section";

export function SiteAbout({ site }: { site: PublicClinicSite }) {
  const hasContent =
    site.short_description ||
    site.payment_methods.length > 0 ||
    site.cancellation_policy ||
    site.parking_info ||
    site.accessibility_info;

  if (!hasContent) return null;

  const highlights = [
    site.payment_methods.length > 0 && {
      icon: CreditCard,
      title: "Pagamento",
      text: site.payment_methods.join(", "),
    },
    site.parking_info && {
      icon: Car,
      title: "Estacionamento",
      text: site.parking_info,
    },
    site.accessibility_info && {
      icon: Accessibility,
      title: "Acessibilidade",
      text: site.accessibility_info,
    },
    site.cancellation_policy && {
      icon: HeartHandshake,
      title: "Cancelamentos",
      text: site.cancellation_policy,
    },
  ].filter(Boolean) as { icon: typeof CreditCard; title: string; text: string }[];

  return (
    <SiteSection id="sobre">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
        <div>
          <SiteSectionHeader
            eyebrow="Quem somos"
            title="Um lugar de acolhimento e cuidado"
            description={
              site.short_description
                ? undefined
                : "Conheça nossa clínica e descubra como podemos cuidar de você."
            }
          />
          {site.short_description && (
            <p className="text-lg text-[#5c6f68] leading-relaxed whitespace-pre-wrap -mt-6">
              {site.short_description}
            </p>
          )}
        </div>

        {highlights.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-4">
            {highlights.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-2xl bg-[#f7faf9] border border-[#e8efec] p-5 hover:shadow-md hover:shadow-[#1a2e28]/5 transition-shadow"
              >
                <div className="h-10 w-10 rounded-xl bg-white border border-[#e8efec] flex items-center justify-center mb-3">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-[#1a2e28]">{title}</h3>
                <p className="mt-1.5 text-sm text-[#5c6f68] leading-relaxed whitespace-pre-wrap">
                  {text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </SiteSection>
  );
}
