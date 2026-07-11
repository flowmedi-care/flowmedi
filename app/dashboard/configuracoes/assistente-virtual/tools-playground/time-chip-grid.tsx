"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Period, TimeOption } from "./booking-options-adapter";
import { PERIOD_LABELS } from "./booking-options-adapter";

const PERIOD_ICONS: Record<Period, string> = {
  manha: "☀",
  tarde: "🌙",
};

const COLLAPSE_THRESHOLD = 6;

type Props = {
  times: TimeOption[];
  selectedId?: string;
  onSelect: (time: TimeOption) => void;
  groupByPeriod?: boolean;
};

function TimeChip({
  time,
  selected,
  onSelect,
}: {
  time: TimeOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "inline-flex min-w-[4.5rem] items-center justify-center gap-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background hover:bg-muted"
      )}
    >
      {selected && <Check className="h-3.5 w-3.5" />}
      {time.label}
    </button>
  );
}

function PeriodSection({
  period,
  times,
  selectedId,
  onSelect,
  defaultOpen,
}: {
  period: Period;
  times: TimeOption[];
  selectedId?: string;
  onSelect: (time: TimeOption) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const collapsible = times.length > COLLAPSE_THRESHOLD;

  if (!times.length) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left text-sm font-medium"
        onClick={() => collapsible && setOpen(!open)}
        disabled={!collapsible}
      >
        <span>{PERIOD_ICONS[period]}</span>
        <span>
          {PERIOD_LABELS[period]} ({times.length})
        </span>
        {collapsible && (
          <ChevronDown
            className={cn("ml-auto h-4 w-4 transition-transform", open && "rotate-180")}
          />
        )}
      </button>
      {(!collapsible || open) && (
        <div className="flex flex-wrap gap-2">
          {times.map((time) => (
            <TimeChip
              key={time.scheduledAt}
              time={time}
              selected={selectedId === time.scheduledAt}
              onSelect={() => onSelect(time)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TimeChipGrid({ times, selectedId, onSelect, groupByPeriod = true }: Props) {
  if (!times.length) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Nenhum horário disponível neste dia.
      </p>
    );
  }

  if (!groupByPeriod) {
    return (
      <div className="flex flex-wrap gap-2">
        {times.map((time) => (
          <TimeChip
            key={time.scheduledAt}
            time={time}
            selected={selectedId === time.scheduledAt}
            onSelect={() => onSelect(time)}
          />
        ))}
      </div>
    );
  }

  const manha = times.filter((t) => t.period === "manha");
  const tarde = times.filter((t) => t.period === "tarde");

  return (
    <div className="space-y-4">
      <PeriodSection
        period="manha"
        times={manha}
        selectedId={selectedId}
        onSelect={onSelect}
        defaultOpen
      />
      <PeriodSection
        period="tarde"
        times={tarde}
        selectedId={selectedId}
        onSelect={onSelect}
        defaultOpen={tarde.length <= COLLAPSE_THRESHOLD}
      />
    </div>
  );
}
