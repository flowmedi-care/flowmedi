"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  buildRecurrenceSessionSlots,
  formatRecurrenceSessionLine,
  weekdayLabelFromDate,
  type RecurrenceFrequency,
} from "@/lib/recurrence-schedule";
import { checkRecurrenceSlotsConflicts } from "./actions";

export type RecurrenceFormState = {
  enabled: boolean;
  frequency: RecurrenceFrequency;
  sessionCount: number;
  overrides: Record<number, { date: string; time: string }>;
};

export const defaultRecurrenceForm = (): RecurrenceFormState => ({
  enabled: false,
  frequency: "semanal",
  sessionCount: 4,
  overrides: {},
});

type Props = {
  date: string;
  time: string;
  doctorId: string;
  appointmentTypeId: string;
  recurrence: RecurrenceFormState;
  onRecurrenceChange: (patch: Partial<RecurrenceFormState>) => void;
  isEdit: boolean;
};

export function AppointmentDateTimeRecurrence({
  date,
  time,
  doctorId,
  appointmentTypeId,
  recurrence,
  onRecurrenceChange,
  isEdit,
}: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [conflicts, setConflicts] = useState<boolean[]>([]);

  const slots = useMemo(() => {
    if (!recurrence.enabled || !date) return [];
    const count = Math.min(52, Math.max(2, recurrence.sessionCount));
    return buildRecurrenceSessionSlots(
      date,
      time || "09:00",
      count,
      recurrence.frequency,
      recurrence.overrides
    );
  }, [
    recurrence.enabled,
    recurrence.sessionCount,
    recurrence.frequency,
    recurrence.overrides,
    date,
    time,
  ]);

  useEffect(() => {
    if (!recurrence.enabled || !doctorId || slots.length === 0) {
      setConflicts([]);
      return;
    }
    let cancelled = false;
    checkRecurrenceSlotsConflicts(
      doctorId,
      appointmentTypeId || null,
      slots.map((s) => s.scheduledAt)
    ).then((res) => {
      if (!cancelled) setConflicts(res.conflicts);
    });
    return () => {
      cancelled = true;
    };
  }, [recurrence.enabled, doctorId, appointmentTypeId, slots]);

  const weekdayLabel = date ? weekdayLabelFromDate(date) : "—";

  function startEdit(index: number) {
    const slot = slots[index];
    if (!slot) return;
    const d = new Date(slot.scheduledAt);
    setEditDate(d.toISOString().slice(0, 10));
    setEditTime(d.toTimeString().slice(0, 5));
    setEditingIndex(index);
  }

  function saveEdit() {
    if (editingIndex == null) return;
    onRecurrenceChange({
      overrides: {
        ...recurrence.overrides,
        [editingIndex]: { date: editDate, time: editTime },
      },
    });
    setEditingIndex(null);
  }

  if (isEdit) return null;

  return (
    <>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={recurrence.enabled}
          onChange={(e) => onRecurrenceChange({ enabled: e.target.checked })}
        />
        Repetir consulta (recorrência)
      </label>

      {recurrence.enabled && (
        <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Frequência</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={recurrence.frequency}
                onChange={(e) =>
                  onRecurrenceChange({
                    frequency: e.target.value as RecurrenceFrequency,
                    overrides: {},
                  })
                }
              >
                <option value="semanal">Semanal</option>
                <option value="quinzenal">Quinzenal</option>
                <option value="mensal">Mensal</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Número de sessões</Label>
              <Input
                type="number"
                min={2}
                max={52}
                value={recurrence.sessionCount}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10) || 2;
                  onRecurrenceChange({
                    sessionCount: Math.min(52, Math.max(2, n)),
                  });
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Dia da semana</Label>
              <Input readOnly value={weekdayLabel} className="bg-muted/50" />
            </div>
            <div className="space-y-1">
              <Label>Horário</Label>
              <Input readOnly value={time || "—"} className="bg-muted/50" />
            </div>
          </div>

          <div className="border-t pt-3 space-y-2">
            <p className="text-sm font-medium">Prévia das sessões agendadas</p>
            <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
              {slots.map((slot, i) => {
                const fmt = formatRecurrenceSessionLine(slot.scheduledAt);
                const hasConflict = conflicts[i];
                return (
                  <li
                    key={slot.index}
                    className="flex flex-wrap items-center gap-2 justify-between rounded-md border bg-background px-2 py-1.5"
                  >
                    {editingIndex === i ? (
                      <div className="flex flex-wrap gap-2 w-full items-end">
                        <Input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="flex-1 min-w-[120px]"
                        />
                        <Input
                          type="time"
                          step={60}
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                          className="w-28"
                        />
                        <Button type="button" size="sm" onClick={saveEdit}>
                          OK
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingIndex(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="flex items-center gap-1.5 flex-wrap">
                          {hasConflict && (
                            <span title="Conflito de horário">⚠️</span>
                          )}
                          <span>
                            Sessão {i + 1}{" "}
                            <span className="text-muted-foreground">
                              {fmt.weekdayShort}, {fmt.date} {fmt.time}
                            </span>
                          </span>
                          {slot.customized && (
                            <span className="text-xs text-primary">(personalizada)</span>
                          )}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(i)}
                        >
                          Editar
                        </Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
