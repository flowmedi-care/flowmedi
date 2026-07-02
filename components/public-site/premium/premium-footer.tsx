import Link from "next/link";
import { Facebook, Instagram, Mail, MapPin, Phone } from "lucide-react";
import { LogoImage } from "@/components/logo-image";
import type { PublicClinicSite } from "@/lib/public-site/types";

export function PremiumFooter({ site }: { site: PublicClinicSite }) {
  const year = new Date().getFullYear();

  const quickLinks = [
    { href: "#inicio", label: "Início" },
    { href: "#sobre", label: "Sobre" },
    ...(site.site.show_services && site.procedures.length > 0
      ? [{ href: "#especialidades", label: "Especialidades" }]
      : []),
    ...(site.site.show_team && site.doctors.length > 0
      ? [{ href: "#equipe", label: "Corpo Clínico" }]
      : []),
    { href: "#contato", label: "Contato" },
  ];

  return (
    <footer className="bg-[var(--site-text)] text-slate-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 lg:py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
          <div>
            {site.logo_url ? (
              <div className="inline-flex rounded-xl bg-white px-4 py-3 mb-4 shadow-md">
                <LogoImage
                  src={site.logo_url}
                  alt={site.name}
                  className="max-h-12 max-w-[180px] object-contain"
                  scale={Math.min(site.logo_scale, 120)}
                />
              </div>
            ) : (
              <p className="text-lg font-bold text-white mb-4">{site.name}</p>
            )}
            <p className="text-sm leading-relaxed text-slate-400">
              Cuidando da sua saúde com excelência e humanidade.
            </p>
            <div className="mt-4 flex gap-3">
              {site.instagram_url && (
                <a
                  href={site.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {site.facebook_url && (
                <a
                  href={site.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Links rápidos
            </h4>
            <ul className="space-y-2 text-sm">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <Link href="/politica-de-privacidade" className="hover:text-white transition-colors">
                  Política de privacidade
                </Link>
              </li>
              <li>
                <Link href="/termos-de-servico" className="hover:text-white transition-colors">
                  Termos de serviço
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Contato
            </h4>
            <ul className="space-y-3 text-sm">
              {site.phone && (
                <li>
                  <a href={`tel:${site.phone}`} className="flex items-center gap-2 hover:text-white">
                    <Phone className="h-4 w-4 shrink-0" />
                    {site.phone}
                  </a>
                </li>
              )}
              {site.email && (
                <li>
                  <a href={`mailto:${site.email}`} className="flex items-center gap-2 hover:text-white">
                    <Mail className="h-4 w-4 shrink-0" />
                    {site.email}
                  </a>
                </li>
              )}
              {site.address && (
                <li className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{site.address}</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between gap-4 text-xs text-slate-500">
          <p>
            © {year} {site.name}. Todos os direitos reservados.
          </p>
          <p>
            Tecnologia{" "}
            <a
              href="https://flowmed.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors"
            >
              Flowmedi
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
