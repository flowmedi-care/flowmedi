import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import type { PublicSiteProcedure } from "@/lib/public-site/types";
import {
  getServiceGradient,
  getServiceIcon,
  truncateText,
} from "@/lib/public-site/presentation";
import { cn } from "@/lib/utils";

type ServiceCardProps = {
  procedure: PublicSiteProcedure;
  slug: string;
  actionLabel: string;
  bookingAvailable: boolean;
  whatsappUrl?: string | null;
};

export function ServiceCard({
  procedure,
  slug,
  actionLabel,
  bookingAvailable,
  whatsappUrl,
}: ServiceCardProps) {
  const Icon = getServiceIcon(procedure.id);
  const gradient = getServiceGradient(procedure.id);
  const description = procedure.recommendations
    ? truncateText(procedure.recommendations, 90)
    : null;

  const href = bookingAvailable
    ? `/c/${slug}/agendar?procedure=${procedure.id}`
    : whatsappUrl ?? `#localizacao`;

  return (
    <article className="group flex flex-col rounded-2xl bg-white border border-[#e8efec] overflow-hidden hover:shadow-xl hover:shadow-[#1a2e28]/6 transition-all duration-300">
      <div
        className={cn(
          "relative h-24 flex items-center justify-center bg-gradient-to-br",
          gradient
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_rgba(255,255,255,0.15)_0%,_transparent_50%)]" />
        <Icon className="relative h-9 w-9 text-white/90" strokeWidth={1.5} />
      </div>

      <div className="flex flex-col flex-1 p-5 sm:p-6">
        <h3 className="text-lg font-semibold text-[#1a2e28] leading-snug group-hover:text-primary transition-colors">
          {procedure.name}
        </h3>

        {description && (
          <p className="mt-2 text-sm text-[#5c6f68] leading-relaxed line-clamp-2">
            {description}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 text-sm text-[#5c6f68]">
          <Clock className="h-3.5 w-3.5 text-primary/70 shrink-0" />
          <span>~{procedure.duration_minutes} min</span>
        </div>

        <div className="mt-5 pt-4 border-t border-[#f0f5f3]">
          {bookingAvailable || whatsappUrl ? (
            <Link
              href={href}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:gap-2.5 transition-all"
            >
              {actionLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="text-sm text-[#5c6f68]">Entre em contato para agendar</span>
          )}
        </div>
      </div>
    </article>
  );
}
