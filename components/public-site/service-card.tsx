import Link from "next/link";
import { Clock } from "lucide-react";
import type { PublicSiteProcedure } from "@/lib/public-site/types";
import { truncateText } from "@/lib/public-site/presentation";

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
  const description = procedure.recommendations
    ? truncateText(procedure.recommendations, 120)
    : null;

  const href = bookingAvailable
    ? `/c/${slug}/agendar?procedure=${procedure.id}`
    : whatsappUrl ?? `#contato`;

  const canBook = bookingAvailable || Boolean(whatsappUrl);

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition-all duration-300 hover:border-[var(--site-primary)]/30 hover:shadow-lg hover:shadow-slate-200/60">
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-[var(--site-text)] leading-snug tracking-tight group-hover:text-[var(--site-primary)] transition-colors">
          {procedure.name}
        </h3>

        {description ? (
          <p className="mt-3 text-sm text-[var(--site-muted)] leading-relaxed line-clamp-3">
            {description}
          </p>
        ) : (
          <p className="mt-3 text-sm text-[var(--site-muted)]/80 leading-relaxed">
            Atendimento realizado por profissionais da nossa equipe.
          </p>
        )}
      </div>

      <div className="mt-6 space-y-4 border-t border-slate-100 pt-5">
        <p className="flex items-center gap-2 text-xs font-medium text-[var(--site-muted)]">
          <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--site-primary)]/80" />
          Duração estimada: {procedure.duration_minutes} min
        </p>

        {canBook ? (
          <Link
            href={href}
            className="flex w-full items-center justify-center rounded-lg bg-[var(--site-accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/20 transition-all hover:brightness-105"
          >
            {actionLabel}
          </Link>
        ) : (
          <p className="text-center text-sm text-[var(--site-muted)]">
            Entre em contato para agendar
          </p>
        )}
      </div>
    </article>
  );
}
