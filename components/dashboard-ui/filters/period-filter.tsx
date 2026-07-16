"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/dashboard-ui/filters/segmented-control";
import { cn } from "@/lib/utils";
import {
  type FunnelPeriod,
  type TimeGranularity,
  formatLocalDateKey,
  getPresetFunnelPeriod,
} from "@/lib/analytics/time-buckets";

const PRESET_OPTIONS = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês anterior" },
  { value: "custom", label: "Personalizado" },
] as const;

const GRANULARITY_OPTIONS: { value: TimeGranularity; label: string }[] = [
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
];

const MONTHS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

export type MonthPeriodValue = { year: number; month: number };

type RangeProps = {
  mode: "range";
  value: FunnelPeriod;
  onChange: (period: FunnelPeriod) => void;
  className?: string;
  showGranularity?: boolean;
};

type MonthProps = {
  mode: "month";
  value: MonthPeriodValue;
  onChange: (value: MonthPeriodValue) => void;
  className?: string;
  showGranularity?: never;
};

export type PeriodFilterProps = RangeProps | MonthProps;

export function PeriodFilter(props: PeriodFilterProps) {
  if (props.mode === "month") {
    return <MonthPeriodFilter {...props} />;
  }
  return <RangePeriodFilter {...props} />;
}

function RangePeriodFilter({
  value,
  onChange,
  className,
  showGranularity = true,
}: RangeProps) {
  const [activePreset, setActivePreset] = useState<string>("30d");
  const [customStart, setCustomStart] = useState(value.start);
  const [customEnd, setCustomEnd] = useState(value.end);
  const showCustom = activePreset === "custom";

  const handlePreset = (preset: string) => {
    if (preset === "custom") {
      setActivePreset("custom");
      setCustomStart(value.start);
      setCustomEnd(value.end);
      return;
    }
    setActivePreset(preset);
    const next = getPresetFunnelPeriod(preset);
    onChange({ ...next, granularity: value.granularity });
    setCustomStart(next.start);
    setCustomEnd(next.end);
  };

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    setActivePreset("custom");
    onChange({ start: customStart, end: customEnd, granularity: value.granularity });
  };

  return (
    <div className={cn("flex flex-col gap-2 min-w-0", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          value={activePreset}
          onChange={handlePreset}
          size="sm"
          aria-label="Período"
          className="flex-wrap"
        >
          {PRESET_OPTIONS.map((p) => (
            <SegmentedControl.Item key={p.value} value={p.value}>
              {p.label}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl>

        {showGranularity && (
          <SegmentedControl
            value={value.granularity}
            onChange={(g) => onChange({ ...value, granularity: g as TimeGranularity })}
            size="sm"
            aria-label="Granularidade"
          >
            {GRANULARITY_OPTIONS.map((g) => (
              <SegmentedControl.Item key={g.value} value={g.value}>
                {g.label}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl>
        )}
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            aria-label="De"
            value={customStart}
            max={customEnd || formatLocalDateKey(new Date())}
            onChange={(e) => setCustomStart(e.target.value)}
            className="h-8 w-[140px] text-xs"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            aria-label="Até"
            value={customEnd}
            min={customStart}
            max={formatLocalDateKey(new Date())}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="h-8 w-[140px] text-xs"
          />
          <Button type="button" size="sm" variant="secondary" className="h-8" onClick={applyCustom}>
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
}

function MonthPeriodFilter({ value, onChange, className }: MonthProps) {
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Select
        className="h-9 w-36"
        value={String(value.month)}
        aria-label="Mês"
        onChange={(e) =>
          onChange({ year: value.year, month: parseInt(e.target.value, 10) })
        }
      >
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </Select>
      <Select
        className="h-9 w-28"
        value={String(value.year)}
        aria-label="Ano"
        onChange={(e) =>
          onChange({ year: parseInt(e.target.value, 10), month: value.month })
        }
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
    </div>
  );
}

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
