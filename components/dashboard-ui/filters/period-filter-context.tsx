"use client";

import { createContext, useContext } from "react";
import type { FunnelPeriod } from "@/lib/analytics/time-buckets";
import type { MonthPeriodValue } from "./period-filter-types";

type RangeContext = {
  mode: "range";
  value: FunnelPeriod;
  onChange: (period: FunnelPeriod) => void;
  activePreset: string;
  setActivePreset: (preset: string) => void;
  customStart: string;
  customEnd: string;
  setCustomStart: (v: string) => void;
  setCustomEnd: (v: string) => void;
  applyCustom: () => void;
  showGranularity: boolean;
};

type MonthContext = {
  mode: "month";
  value: MonthPeriodValue;
  onChange: (value: MonthPeriodValue) => void;
  activePreset: string;
  setActivePreset: (preset: string) => void;
  customStart: string;
  customEnd: string;
  setCustomStart: (v: string) => void;
  setCustomEnd: (v: string) => void;
  applyCustom: () => void;
  showGranularity: boolean;
};

export type PeriodFilterContextValue = RangeContext | MonthContext;

const PeriodFilterContext = createContext<PeriodFilterContextValue | null>(null);

export function PeriodFilterProvider({
  value,
  children,
}: {
  value: PeriodFilterContextValue;
  children: React.ReactNode;
}) {
  return (
    <PeriodFilterContext.Provider value={value}>{children}</PeriodFilterContext.Provider>
  );
}

export function usePeriodFilter() {
  const ctx = useContext(PeriodFilterContext);
  if (!ctx) {
    throw new Error("PeriodSummary/PeriodControls must be used within PeriodFilter");
  }
  return ctx;
}
