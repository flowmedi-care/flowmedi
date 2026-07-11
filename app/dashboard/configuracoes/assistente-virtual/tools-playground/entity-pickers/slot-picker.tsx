"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Code2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getNestedValue } from "@/lib/virtual-assistant/tools/playground-metadata";
import {
  parseTimesFromAiState,
  type TimeOption,
} from "../booking-options-adapter";
import { TimeChipGrid } from "../time-chip-grid";

type Props = {
  value: string;
  onChange: (v: string) => void;
  aiState: Record<string, unknown>;
  label?: string;
  placeholder?: string;
};

function collectTimesFromState(aiState: Record<string, unknown>): TimeOption[] {
  const bookingDate = getNestedValue(aiState, "booking.date");
  const dateStr = bookingDate ? String(bookingDate) : new Date().toISOString().slice(0, 10);

  const pending = getNestedValue(aiState, "booking.pending_slot");
  let times = parseTimesFromAiState(aiState, dateStr, true);

  if (pending != null && pending !== "") {
    const pendingStr = String(pending);
    if (!times.some((t) => t.scheduledAt === pendingStr)) {
      const d = new Date(pendingStr);
      const label = Number.isNaN(d.getTime())
        ? pendingStr
        : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      times = [
        {
          index: 0,
          scheduledAt: pendingStr,
          label,
          period: d.getHours() < 12 ? "manha" : "tarde",
          isPast: false,
        },
        ...times,
      ];
    }
  }

  return times;
}

export function SlotPicker({
  value,
  onChange,
  aiState,
  label = "Data e horário",
  placeholder = "2026-08-15T14:30:00-03:00",
}: Props) {
  const [manualMode, setManualMode] = useState(false);
  const times = useMemo(() => collectTimesFromState(aiState), [aiState]);
  const selectedTime = times.find((t) => t.scheduledAt === value);

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}

      {!manualMode && times.length > 0 ? (
        <>
          <TimeChipGrid
            times={times}
            selectedId={value || undefined}
            onSelect={(time) => onChange(time.scheduledAt)}
          />
          {value && selectedTime && (
            <p className="text-xs text-muted-foreground">
              Selecionado: <span className="font-medium">{selectedTime.label}</span>
              <span className="ml-2 font-mono text-[10px] opacity-60">{value}</span>
            </p>
          )}
        </>
      ) : !manualMode ? (
        <div className="rounded-md border border-dashed px-3 py-4 text-center">
          <CalendarClock className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum horário no estado da conversa.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use o fluxo de agendamento ou digite o ISO manualmente.
          </p>
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Code2 className="h-3.5 w-3.5" />
        <span>Digitar ISO manualmente</span>
        <Switch checked={manualMode} onChange={setManualMode} />
      </div>

      {(manualMode || times.length === 0) && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="font-mono text-xs"
        />
      )}
    </div>
  );
}
