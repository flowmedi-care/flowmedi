import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import type { PublicSiteProcedure } from "@/lib/public-site/types";
import { publicSiteBookingPath } from "@/lib/public-site/urls";

type ServiceCardProps = {
  procedure: PublicSiteProcedure;
  slug: string;
  onClinicSubdomain: boolean;
  actionLabel: string;
  bookingAvailable: boolean;
  whatsappUrl?: string | null;
};

export function ServiceCard({
  procedure,
  slug,
  onClinicSubdomain,
  actionLabel,
  bookingAvailable,
  whatsappUrl,
}: ServiceCardProps) {
  const href = bookingAvailable
    ? publicSiteBookingPath(slug, onClinicSubdomain, { procedure: procedure.id })
    : whatsappUrl ?? `#contato`;

  const canBook = bookingAvailable || Boolean(whatsappUrl);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--site-primary)]/35 hover:shadow-md hover:shadow-slate-200/70">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-[var(--site-primary)] transition-transform duration-300 group-hover:scale-x-100"
        aria-hidden
      />

      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold leading-snug tracking-tight text-[var(--site-text)] transition-colors group-hover:text-[var(--site-primary)] sm:text-lg">
            {procedure.name}
          </h3>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-[var(--site-muted)] ring-1 ring-inset ring-slate-200/80">
            <Clock className="h-3.5 w-3.5 text-[var(--site-primary)]/80" aria-hidden />
            {procedure.duration_minutes} min
          </span>
        </div>

        {canBook ? (
          <Link
            href={href}
            className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--site-accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/15 transition-all hover:brightness-105 group-hover:gap-2.5"
          >
            {actionLabel}
            <ArrowRight className="h-4 w-4 opacity-90" aria-hidden />
          </Link>
        ) : (
          <p className="mt-auto text-center text-sm text-[var(--site-muted)]">
            Entre em contato para agendar
          </p>
        )}
      </div>
    </article>
  );
}
