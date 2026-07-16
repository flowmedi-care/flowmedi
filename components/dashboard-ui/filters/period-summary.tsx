"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  formatMonthPeriodLabel,
  formatPeriodRangeShort,
  getPeriodPresetLabel,
  type FunnelPeriod,
} from "@/lib/analytics/time-buckets";
import { usePeriodFilter } from "./period-filter-context";
import type { MonthPeriodValue } from "./period-filter-types";

export function PeriodSummary({ className }: { className?: string }) {
  const ctx = usePeriodFilter();
  const title =
    ctx.mode === "range"
      ? getPeriodPresetLabel(ctx.activePreset)
      : formatMonthPeriodLabel(ctx.value.year, ctx.value.month);

  const subtitle =
    ctx.mode === "range" ? formatPeriodRangeShort(ctx.value as FunnelPeriod) : null;

  const animKey =
    ctx.mode === "range"
      ? `${ctx.activePreset}-${(ctx.value as FunnelPeriod).start}-${(ctx.value as FunnelPeriod).end}`
      : `${(ctx.value as MonthPeriodValue).year}-${(ctx.value as MonthPeriodValue).month}`;

  const [visible, setVisible] = useState(true);
  const [displayKey, setDisplayKey] = useState(animKey);
  const [displayTitle, setDisplayTitle] = useState(title);
  const [displaySubtitle, setDisplaySubtitle] = useState(subtitle);

  useEffect(() => {
    if (animKey === displayKey) return;
    setVisible(false);
    const t = window.setTimeout(() => {
      setDisplayKey(animKey);
      setDisplayTitle(title);
      setDisplaySubtitle(subtitle);
      setVisible(true);
    }, 75);
    return () => window.clearTimeout(t);
  }, [animKey, title, subtitle, displayKey]);

  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-xs font-medium text-muted-foreground mb-1">Período</p>
      <div
        key={displayKey}
        className={cn(
          "transition-all duration-150 ease-out",
          visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-0.5"
        )}
      >
        <p className="text-sm font-medium text-foreground leading-snug">{displayTitle}</p>
        {displaySubtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{displaySubtitle}</p>
        )}
      </div>
    </div>
  );
}
