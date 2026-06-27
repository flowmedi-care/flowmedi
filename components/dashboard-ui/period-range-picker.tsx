"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
] as const;

const GRANULARITY_OPTIONS: { value: TimeGranularity; label: string }[] = [
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
];

type PeriodRangePickerProps = {
  period: FunnelPeriod;
  onChange: (period: FunnelPeriod) => void;
  className?: string;
};

export function PeriodRangePicker({ period, onChange, className }: PeriodRangePickerProps) {
  const [activePreset, setActivePreset] = useState<string>("30d");
  const [customStart, setCustomStart] = useState(period.start);
  const [customEnd, setCustomEnd] = useState(period.end);
  const [showCustom, setShowCustom] = useState(false);

  const handlePreset = (preset: string) => {
    setActivePreset(preset);
    setShowCustom(false);
    const next = getPresetFunnelPeriod(preset);
    onChange({ ...next, granularity: period.granularity });
    setCustomStart(next.start);
    setCustomEnd(next.end);
  };

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    setActivePreset("custom");
    setShowCustom(true);
    onChange({ start: customStart, end: customEnd, granularity: period.granularity });
  };

  const handleGranularity = (granularity: TimeGranularity) => {
    onChange({ ...period, granularity });
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap gap-1">
        {PRESET_OPTIONS.map((p) => (
          <Button
            key={p.value}
            type="button"
            size="sm"
            variant={!showCustom && activePreset === p.value ? "secondary" : "ghost"}
            className="h-8 text-xs sm:text-sm"
            onClick={() => handlePreset(p.value)}
          >
            {p.label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={showCustom ? "secondary" : "ghost"}
          className="h-8 text-xs sm:text-sm"
          onClick={() => setShowCustom(true)}
        >
          Personalizado
        </Button>
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">De</label>
            <Input
              type="date"
              value={customStart}
              max={customEnd || formatLocalDateKey(new Date())}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-9 w-[140px]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Até</label>
            <Input
              type="date"
              value={customEnd}
              min={customStart}
              max={formatLocalDateKey(new Date())}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-9 w-[140px]"
            />
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={applyCustom}>
            Aplicar
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {GRANULARITY_OPTIONS.map((g) => (
          <Button
            key={g.value}
            type="button"
            size="sm"
            variant={period.granularity === g.value ? "secondary" : "ghost"}
            className="h-8 text-xs"
            onClick={() => handleGranularity(g.value)}
          >
            {g.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
