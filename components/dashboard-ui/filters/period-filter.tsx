"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FunnelPeriod } from "@/lib/analytics/time-buckets";
import { getPresetFunnelPeriod } from "@/lib/analytics/time-buckets";
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
  /**
   * Limpar extras + aplicar período default.
   * Se omitido, só reseta o período (30d / dia).
   */
  onClear?: (defaultPeriod: FunnelPeriod) => void;
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
  onClear?: (defaultPeriod: MonthPeriodValue) => void;
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

function defaultMonthPeriod(): MonthPeriodValue {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function ModalFilterFooter({
  onClear,
  onClose,
  canClear,
}: {
  onClear: () => void;
  onClose: () => void;
  canClear: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!canClear}
        onClick={onClear}
      >
        Limpar tudo
      </Button>
      <Button type="button" size="sm" onClick={onClose}>
        Fechar
      </Button>
    </div>
  );
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
  onClear,
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

  const periodActiveCount = countRangeFilters(
    activePreset,
    value.granularity,
    showGranularity
  );
  const badgeCount = periodActiveCount + extraActiveCount;
  const canClear = badgeCount > 0;

  const clearAll = () => {
    const next = getPresetFunnelPeriod("30d");
    const cleared: FunnelPeriod = {
      ...next,
      granularity: showGranularity ? "day" : value.granularity,
    };
    setActivePreset("30d");
    setCustomStart(cleared.start);
    setCustomEnd(cleared.end);
    if (onClear) {
      onClear(cleared);
    } else {
      onChange(cleared);
    }
  };

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
                <ModalFilterFooter
                  canClear={canClear}
                  onClear={clearAll}
                  onClose={() => setOpen(false)}
                />
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
  onClear,
  children,
}: MonthProps) {
  const [open, setOpen] = useState(false);

  const periodActiveCount = useMemo(
    () => countMonthFilters(value.year, value.month),
    [value.year, value.month]
  );
  const badgeCount = periodActiveCount + extraActiveCount;
  const canClear = badgeCount > 0;

  const clearAll = () => {
    const cleared = defaultMonthPeriod();
    if (onClear) {
      onClear(cleared);
    } else {
      onChange(cleared);
    }
  };

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
                <ModalFilterFooter
                  canClear={canClear}
                  onClear={clearAll}
                  onClose={() => setOpen(false)}
                />
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
