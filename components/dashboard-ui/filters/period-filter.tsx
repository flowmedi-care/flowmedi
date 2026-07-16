"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { FunnelPeriod } from "@/lib/analytics/time-buckets";
import { PeriodFilterProvider } from "./period-filter-context";
import { PeriodSummary } from "./period-summary";
import { PeriodControls } from "./period-controls";
import type { MonthPeriodValue } from "./period-filter-types";

export type { MonthPeriodValue } from "./period-filter-types";
export { PeriodSummary } from "./period-summary";
export { PeriodControls } from "./period-controls";
export { FilterControlZone } from "./filter-control-zone";

type RangeProps = {
  mode: "range";
  value: FunnelPeriod;
  onChange: (period: FunnelPeriod) => void;
  className?: string;
  showGranularity?: boolean;
  children?: ReactNode;
};

type MonthProps = {
  mode: "month";
  value: MonthPeriodValue;
  onChange: (value: MonthPeriodValue) => void;
  className?: string;
  showGranularity?: never;
  children?: ReactNode;
};

export type PeriodFilterProps = RangeProps | MonthProps;

export function PeriodFilter(props: PeriodFilterProps) {
  if (props.mode === "month") {
    return <MonthPeriodFilterRoot {...props} />;
  }
  return <RangePeriodFilterRoot {...props} />;
}

function RangePeriodFilterRoot({
  value,
  onChange,
  className,
  showGranularity = true,
  children,
}: RangeProps) {
  const [activePreset, setActivePreset] = useState<string>("30d");
  const [customStart, setCustomStart] = useState(value.start);
  const [customEnd, setCustomEnd] = useState(value.end);

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    setActivePreset("custom");
    onChange({ start: customStart, end: customEnd, granularity: value.granularity });
  };

  return (
    <PeriodFilterProvider
      value={{
        mode: "range",
        value,
        onChange,
        activePreset,
        setActivePreset,
        customStart,
        customEnd,
        setCustomStart,
        setCustomEnd,
        applyCustom,
        showGranularity,
      }}
    >
      <div className={cn("flex flex-col min-w-0 w-full", className)}>
        {children ?? (
          <>
            <PeriodSummary />
            <PeriodControls />
          </>
        )}
      </div>
    </PeriodFilterProvider>
  );
}

function MonthPeriodFilterRoot({ value, onChange, className, children }: MonthProps) {
  return (
    <PeriodFilterProvider
      value={{
        mode: "month",
        value,
        onChange,
        activePreset: "month",
        setActivePreset: () => {},
        customStart: "",
        customEnd: "",
        setCustomStart: () => {},
        setCustomEnd: () => {},
        applyCustom: () => {},
        showGranularity: false,
      }}
    >
      <div className={cn("flex flex-col min-w-0 w-full", className)}>
        {children ?? (
          <>
            <PeriodSummary />
            <PeriodControls />
          </>
        )}
      </div>
    </PeriodFilterProvider>
  );
}

PeriodFilter.Summary = PeriodSummary;
PeriodFilter.Controls = PeriodControls;

/** Sync month/year period to URL search params (finance pages). */
export function useMonthPeriodUrl(year: number, month: number) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return {
    value: { year, month } satisfies MonthPeriodValue,
    onChange: (next: MonthPeriodValue) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("year", String(next.year));
      params.set("month", String(next.month));
      router.push(`${pathname}?${params.toString()}`);
    },
  };
}
