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
  type RecurrenceOverride,
} from "@/lib/recurrence-schedule";
import { checkRecurrenceSlotsConflicts } from "./actions";
import { formatAppointmentTimeRange } from "@/lib/appointment-scheduling";

export type RecurrenceFormState = {
  enabled: boolean;
  frequency: RecurrenceFrequency;
  sessionCount: number;
  overrides: Record<number, RecurrenceOverride>;
  forceConflict?: boolean;
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
  endTime: string;
  doctorId: string;
  roomId?: string | null;
  appointmentTypeId: string;
  recurrence: RecurrenceFormState;
  onRecurrenceChange: (patch: Partial<RecurrenceFormState>) => void;
  isEdit: boolean;
  userRole?: string;
  onConflictCountChange?: (count: number) => void;
};

export function AppointmentDateTimeRecurrence({
  date,
  time,
  endTime,
  doctorId,
  roomId,
  appointmentTypeId,
  recurrence,
  onRecurrenceChange,
  isEdit,
  userRole = "secretaria",
  onConflictCountChange,
}: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [conflicts, setConflicts] = useState<boolean[]>([]);

  const slots = useMemo(() => {
    if (!recurrence.enabled || !date) return [];
    const count = Math.min(52, Math.max(2, recurrence.sessionCount));
    return buildRecurrenceSessionSlots(
      date,
      time || "09:00",
      endTime || "09:30",
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
    endTime,
  ]);

  useEffect(() => {
    if (!recurrence.enabled || !doctorId || slots.length === 0) {
      setConflicts([]);
      return;
    }
    let cancelled = false;
    checkRecurrenceSlotsConflicts(
      doctorId,
      slots.map((s) => ({
        scheduledAt: s.scheduledAt,
        scheduledEndAt: s.scheduledEndAt,
      })),
      roomId
    ).then((res) => {
      if (!cancelled) setConflicts(res.conflicts);
    });
    return () => {
      cancelled = true;
    };
  }, [recurrence.enabled, doctorId, roomId, slots]);

  const weekdayLabel = date ? weekdayLabelFromDate(date) : "—";
  const conflictCount = conflicts.filter(Boolean).length;

  useEffect(() => {
    onConflictCountChange?.(conflictCount);
  }, [conflictCount, onConflictCountChange]);

  function startEdit(index: number) {
    const slot = slots[index];
    if (!slot) return;
    const d = new Date(slot.scheduledAt);
    const de = new Date(slot.scheduledEndAt);
    setEditDate(d.toISOString().slice(0, 10));
    setEditTime(d.toTimeString().slice(0, 5));
    setEditEndTime(de.toTimeString().slice(0, 5));
    setEditingIndex(index);
  }

  function saveEdit() {
    if (editingIndex == null) return;
    onRecurrenceChange({
      overrides: {
        ...recurrence.overrides,
        [editingIndex]: {
          date: editDate,
          time: editTime,
          endTime: editEndTime,
        },
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
              <Label>Horário base</Label>
              <Input
                readOnly
                value={`${time || "—"} – ${endTime || "—"}`}
                className="bg-muted/50"
              />
            </div>
          </div>

          {conflictCount > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {conflictCount} sessão(ões) em conflito de horário.
            </p>
          )}

          {conflictCount > 0 && userRole === "admin" && (
            <label className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
              <input
                type="checkbox"
                checked={!!recurrence.forceConflict}
                onChange={(e) =>
                  onRecurrenceChange({ forceConflict: e.target.checked })
                }
              />
              Agendar mesmo assim (admin — conflitos ignorados)
            </label>
          )}

          <div className="border-t pt-3 space-y-2">
            <p className="text-sm font-medium">Prévia das sessões agendadas</p>
            <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
              {slots.map((slot, i) => {
                const fmt = formatRecurrenceSessionLine(slot.scheduledAt);
                const range = formatAppointmentTimeRange(slot.scheduledAt, slot.scheduledEndAt);
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
                        <Input
                          type="time"
                          step={60}
                          value={editEndTime}
                          onChange={(e) => setEditEndTime(e.target.value)}
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
                              {fmt.weekdayShort}, {fmt.date} {range}
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
