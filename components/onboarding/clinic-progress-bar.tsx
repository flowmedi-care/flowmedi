"use client";

import { cn } from "@/lib/utils";

export function ClinicProgressBar({
  percent,
  status,
  className,
}: {
  percent: number;
  status: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sua clínica
        </p>
        <p className="text-xs font-medium tabular-nums text-foreground">{clamped}%</p>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso da clínica"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="text-sm text-foreground/90">{status}</p>
    </div>
  );
}
