import { LogoImage } from "@/components/logo-image";
import { Instagram, Facebook } from "lucide-react";
import type { PublicClinicSite } from "@/lib/public-site/types";

export function SiteFooter({ site }: { site: PublicClinicSite }) {
  return (
    <footer className="bg-[#1a2e28] text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
          <div>
            {site.logo_url ? (
              <div className="mb-4 inline-block rounded-xl bg-white p-3">
                <LogoImage
                  src={site.logo_url}
                  alt={site.name}
                  className="max-h-10 max-w-[140px] object-contain"
                  scale={Math.min(site.logo_scale, 100)}
                />
              </div>
            ) : (
              <p className="text-xl font-semibold">{site.name}</p>
            )}
            <p className="text-sm text-white/60 mt-3 leading-relaxed max-w-xs">
              Cuidado de qualidade, perto de você.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-white/90 mb-4">Contato</p>
            <ul className="space-y-2 text-sm text-white/70">
              {site.phone && (
                <li>
                  <a href={`tel:${site.phone.replace(/\D/g, "")}`} className="hover:text-white transition-colors">
                    {site.phone}
                  </a>
                </li>
              )}
              {site.email && (
                <li>
                  <a href={`mailto:${site.email}`} className="hover:text-white transition-colors">
                    {site.email}
                  </a>
                </li>
              )}
              {site.address && <li className="leading-relaxed">{site.address}</li>}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-white/90 mb-4">Redes sociais</p>
            <div className="flex flex-wrap gap-3">
              {site.instagram_url && (
                <a
                  href={site.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15 transition-colors"
                >
                  <Instagram className="h-4 w-4" />
                  Instagram
                </a>
              )}
              {site.facebook_url && (
                <a
                  href={site.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15 transition-colors"
                >
                  <Facebook className="h-4 w-4" />
                  Facebook
                </a>
              )}
              {site.whatsapp_url && (
                <a
                  href={site.whatsapp_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#25D366]/20 text-[#7dffb8] px-4 py-2 text-sm hover:bg-[#25D366]/30 transition-colors"
                >
                  WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/45">
          <p>© {new Date().getFullYear()} {site.name}</p>
          <p>
            Site por{" "}
            <a
              href="https://flowmed.app"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/70 transition-colors"
            >
              FlowMed
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
