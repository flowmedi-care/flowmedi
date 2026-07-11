"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Code2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getNestedValue } from "@/lib/virtual-assistant/tools/playground-metadata";

type SlotItem = {
  scheduled_at: string;
  display: string;
  source: "offered" | "pending" | "legacy";
};

function formatSlotDisplay(scheduledAt: string): string {
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return scheduledAt;
  return date.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function collectSlots(aiState: Record<string, unknown>): SlotItem[] {
  const items: SlotItem[] = [];
  const seen = new Set<string>();

  function add(scheduledAt: string, display: string | undefined, source: SlotItem["source"]) {
    if (!scheduledAt || seen.has(scheduledAt)) return;
    seen.add(scheduledAt);
    items.push({
      scheduled_at: scheduledAt,
      display: display?.trim() || formatSlotDisplay(scheduledAt),
      source,
    });
  }

  const pending = getNestedValue(aiState, "booking.pending_slot");
  if (pending != null && pending !== "") {
    add(String(pending), "Slot pendente", "pending");
  }

  const legacyPending = aiState.pending_slot;
  if (legacyPending != null && legacyPending !== "") {
    add(String(legacyPending), "Slot pendente (legado)", "pending");
  }

  const bookingSlots = getNestedValue(aiState, "booking.offered_slots");
  if (Array.isArray(bookingSlots)) {
    for (const slot of bookingSlots) {
      if (slot && typeof slot === "object") {
        const s = slot as { scheduled_at?: string; display?: string };
        if (s.scheduled_at) add(s.scheduled_at, s.display, "offered");
      }
    }
  }

  const legacySlots = aiState.offered_slots;
  if (Array.isArray(legacySlots)) {
    for (const slot of legacySlots) {
      if (slot && typeof slot === "object") {
        const s = slot as { scheduled_at?: string; display?: string };
        if (s.scheduled_at) add(s.scheduled_at, s.display, "legacy");
      }
    }
  }

  return items.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
}

export function SlotPicker({
  value,
  onChange,
  aiState,
  label = "Data e horário",
  placeholder = "2026-08-15T14:30:00-03:00",
}: {
  value: string;
  onChange: (v: string) => void;
  aiState: Record<string, unknown>;
  label?: string;
  placeholder?: string;
}) {
  const [manualMode, setManualMode] = useState(false);
  const slots = useMemo(() => collectSlots(aiState), [aiState]);
  const selectedSlot = slots.find((s) => s.scheduled_at === value);

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}

      {!manualMode && slots.length > 0 ? (
        <div className="rounded-md border divide-y max-h-52 overflow-y-auto">
          {slots.map((slot, index) => {
            const selected = value === slot.scheduled_at;
            return (
              <button
                key={slot.scheduled_at}
                type="button"
                className={cn(
                  "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                  selected && "bg-primary/10 hover:bg-primary/15"
                )}
                onClick={() => onChange(slot.scheduled_at)}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", selected && "text-primary")}>
                    {slot.display}
                  </p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                    {slot.scheduled_at}
                  </p>
                </div>
                {slot.source === "pending" && (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    pendente
                  </Badge>
                )}
                {selected && (
                  <Badge variant="default" className="shrink-0 text-[10px]">
                    selecionado
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      ) : !manualMode ? (
        <div className="rounded-md border border-dashed px-3 py-4 text-center">
          <CalendarClock className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum horário no estado da conversa.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Execute <code className="text-[10px]">find_available_slots</code> primeiro ou digite o ISO manualmente.
          </p>
        </div>
      ) : null}

      {value && selectedSlot && !manualMode && (
        <p className="text-xs text-muted-foreground">
          Selecionado: <span className="font-medium">{selectedSlot.display}</span>
        </p>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Code2 className="h-3.5 w-3.5" />
        <span>Digitar ISO manualmente</span>
        <Switch
          checked={manualMode}
          onChange={(v) => setManualMode(v)}
        />
      </div>

      {(manualMode || slots.length === 0) && (
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
