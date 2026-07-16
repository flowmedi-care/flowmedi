"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FunnelPeriod } from "@/lib/analytics/time-buckets";
import { PeriodFilterProvider } from "./period-filter-context";
import { PeriodSummary } from "./period-summary";
import { PeriodControls } from "./period-controls";
import { ToolbarFilterButton } from "@/components/dashboard-ui/toolbar/toolbar-filter-button";
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
  /** inline = controles na barra; modal = ícone + dialog (padrão Agenda) */
  presentation?: "modal" | "inline";
  /** Botões à direita do ícone de filtro (ex.: Relatório, Exportar) */
  actions?: ReactNode;
  /** Conteúdo extra no modal (status, profissional, etc.) */
  extraFilters?: ReactNode;
  /** Contagem adicional no badge (além do período) */
  extraActiveCount?: number;
  dialogTitle?: string;
  children?: ReactNode;
};

type MonthProps = {
  mode: "month";
  value: MonthPeriodValue;
  onChange: (value: MonthPeriodValue) => void;
  className?: string;
  showGranularity?: never;
  presentation?: "modal" | "inline";
  actions?: ReactNode;
  extraFilters?: ReactNode;
  extraActiveCount?: number;
  dialogTitle?: string;
  children?: ReactNode;
};

export type PeriodFilterProps = RangeProps | MonthProps;

function countRangeFilters(activePreset: string, granularity: string, showGranularity: boolean) {
  return [
    activePreset !== "30d",
    showGranularity && granularity !== "day",
  ].filter(Boolean).length;
}

function countMonthFilters(year: number, month: number) {
  const now = new Date();
  return year !== now.getFullYear() || month !== now.getMonth() + 1 ? 1 : 0;
}

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
  presentation = "modal",
  actions,
  extraFilters,
  extraActiveCount = 0,
  dialogTitle = "Filtros",
  children,
}: RangeProps) {
  const [activePreset, setActivePreset] = useState<string>("30d");
  const [customStart, setCustomStart] = useState(value.start);
  const [customEnd, setCustomEnd] = useState(value.end);
  const [open, setOpen] = useState(false);

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    setActivePreset("custom");
    onChange({ start: customStart, end: customEnd, granularity: value.granularity });
  };

  const badgeCount =
    countRangeFilters(activePreset, value.granularity, showGranularity) + extraActiveCount;

  const providerValue = {
    mode: "range" as const,
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
  };

  return (
    <PeriodFilterProvider value={providerValue}>
      {presentation === "inline" ? (
        <div className={cn("flex flex-col min-w-0 w-full", className)}>
          {children ?? (
            <>
              <PeriodSummary />
              <PeriodControls />
            </>
          )}
        </div>
      ) : (
        <div className={cn("flex flex-col min-w-0 w-full", className)}>
          <div className="flex w-full items-start justify-between gap-3">
            <PeriodSummary />
            <div className="flex items-center gap-2 shrink-0">
              <ToolbarFilterButton
                count={badgeCount}
                onClick={() => setOpen(true)}
                aria-label="Abrir filtros de período"
              />
              {actions}
            </div>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent title={dialogTitle} onClose={() => setOpen(false)} className="max-w-md">
              <div className="space-y-4">
                <PeriodControls />
                {extraFilters}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </PeriodFilterProvider>
  );
}

function MonthPeriodFilterRoot({
  value,
  onChange,
  className,
  presentation = "modal",
  actions,
  extraFilters,
  extraActiveCount = 0,
  dialogTitle = "Filtros",
  children,
}: MonthProps) {
  const [open, setOpen] = useState(false);

  const badgeCount = useMemo(
    () => countMonthFilters(value.year, value.month) + extraActiveCount,
    [value.year, value.month, extraActiveCount]
  );

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
      {presentation === "inline" ? (
        <div className={cn("flex flex-col min-w-0 w-full", className)}>
          {children ?? (
            <>
              <PeriodSummary />
              <PeriodControls />
            </>
          )}
        </div>
      ) : (
        <div className={cn("flex flex-col min-w-0 w-full", className)}>
          <div className="flex w-full items-start justify-between gap-3">
            <PeriodSummary />
            <div className="flex items-center gap-2 shrink-0">
              <ToolbarFilterButton
                count={badgeCount}
                onClick={() => setOpen(true)}
                aria-label="Abrir filtros de período"
              />
              {actions}
            </div>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent title={dialogTitle} onClose={() => setOpen(false)} className="max-w-md">
              <div className="space-y-4">
                <PeriodControls />
                {extraFilters}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
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
