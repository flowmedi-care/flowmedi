"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/dashboard-ui/filters/segmented-control";
import { FilterControlZone } from "@/components/dashboard-ui/filters/filter-control-zone";
import { cn } from "@/lib/utils";
import {
  type TimeGranularity,
  formatLocalDateKey,
  getPresetFunnelPeriod,
} from "@/lib/analytics/time-buckets";
import { usePeriodFilter } from "./period-filter-context";
import { MONTHS, PRESET_OPTIONS } from "./period-filter-types";

const GRANULARITY_OPTIONS: { value: TimeGranularity; label: string }[] = [
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
];

export function PeriodControls({ className }: { className?: string }) {
  const ctx = usePeriodFilter();

  if (ctx.mode === "month") {
    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
    return (
      <div className={cn("space-y-4", className)}>
        <FilterControlZone label="Período">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              className="h-9 w-36"
              value={String(ctx.value.month)}
              aria-label="Mês"
              onChange={(e) =>
                ctx.onChange({
                  year: ctx.value.year,
                  month: parseInt(e.target.value, 10),
                })
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
              value={String(ctx.value.year)}
              aria-label="Ano"
              onChange={(e) =>
                ctx.onChange({
                  year: parseInt(e.target.value, 10),
                  month: ctx.value.month,
                })
              }
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        </FilterControlZone>
      </div>
    );
  }

  const handlePreset = (preset: string) => {
    if (preset === "custom") {
      ctx.setActivePreset("custom");
      ctx.setCustomStart(ctx.value.start);
      ctx.setCustomEnd(ctx.value.end);
      return;
    }
    ctx.setActivePreset(preset);
    const next = getPresetFunnelPeriod(preset);
    ctx.onChange({ ...next, granularity: ctx.value.granularity });
    ctx.setCustomStart(next.start);
    ctx.setCustomEnd(next.end);
  };

  const showCustom = ctx.activePreset === "custom";

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-4">
        <FilterControlZone label="Período">
          <SegmentedControl
            value={ctx.activePreset}
            onChange={handlePreset}
            size="sm"
            aria-label="Período"
            className="flex-wrap"
          >
            {PRESET_OPTIONS.map((p) => (
              <SegmentedControl.Item key={p.value} value={p.value} title={p.title}>
                {p.label}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl>
        </FilterControlZone>

        {ctx.showGranularity && (
          <FilterControlZone label="Agrupar por">
            <SegmentedControl
              value={ctx.value.granularity}
              onChange={(g) =>
                ctx.onChange({ ...ctx.value, granularity: g as TimeGranularity })
              }
              size="sm"
              aria-label="Agrupar por"
            >
              {GRANULARITY_OPTIONS.map((g) => (
                <SegmentedControl.Item key={g.value} value={g.value}>
                  {g.label}
                </SegmentedControl.Item>
              ))}
            </SegmentedControl>
          </FilterControlZone>
        )}
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            aria-label="De"
            value={ctx.customStart}
            max={ctx.customEnd || formatLocalDateKey(new Date())}
            onChange={(e) => ctx.setCustomStart(e.target.value)}
            className="h-8 w-[140px] text-xs"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            aria-label="Até"
            value={ctx.customEnd}
            min={ctx.customStart}
            max={formatLocalDateKey(new Date())}
            onChange={(e) => ctx.setCustomEnd(e.target.value)}
            className="h-8 w-[140px] text-xs"
          />
          <Button type="button" size="sm" variant="secondary" className="h-8" onClick={ctx.applyCustom}>
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
}
