import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import type { PublicClinicSite } from "@/lib/public-site/types";

export function SiteFooter({ site }: { site: PublicClinicSite }) {
  return (
    <footer className="border-t bg-card py-10 px-4">
      <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="text-center sm:text-left">
          <p className="font-medium">{site.name}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Site hospedado por{" "}
            <a
              href="https://flowmedi.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              FlowMedi
            </a>
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          {site.phone && (
            <a href={`tel:${site.phone.replace(/\D/g, "")}`} className="flex items-center gap-1.5 hover:text-foreground">
              <Phone className="h-4 w-4" />
              {site.phone}
            </a>
          )}
          {site.email && (
            <a href={`mailto:${site.email}`} className="flex items-center gap-1.5 hover:text-foreground">
              <Mail className="h-4 w-4" />
              {site.email}
            </a>
          )}
          {site.instagram_url && (
            <a href={site.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
              Instagram
            </a>
          )}
          {site.facebook_url && (
            <a href={site.facebook_url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
              Facebook
            </a>
          )}
          {site.whatsapp_url && (
            <a href={site.whatsapp_url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
              WhatsApp
            </a>
          )}
        </div>
      </div>
      <div className="mx-auto max-w-5xl mt-6 text-center">
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
          flowmedi.com.br
        </Link>
      </div>
    </footer>
  );
}
