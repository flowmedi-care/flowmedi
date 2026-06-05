import {
  buildPlanSessionDates,
  type PlanScheduleFrequency,
} from "@/lib/financeiro/plan-schedule";
import { buildScheduledEndFromDuration } from "@/lib/appointment-scheduling";

export type RecurrenceFrequency = Exclude<PlanScheduleFrequency, "manual">;

export type RecurrenceSessionSlot = {
  index: number;
  scheduledAt: string;
  scheduledEndAt: string;
  customized: boolean;
};

export type RecurrenceOverride = {
  date: string;
  time: string;
  endTime?: string;
};

const WEEKDAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** RECORRÊNCIA v1 — Gera slots ISO a partir da data base, horário e frequência. */
export function buildRecurrenceSessionSlots(
  firstDate: string,
  time: string,
  endTime: string,
  sessionCount: number,
  frequency: RecurrenceFrequency,
  overrides?: Record<number, RecurrenceOverride>
): RecurrenceSessionSlot[] {
  const baseStart = new Date(`${firstDate}T${time}:00`);
  const baseEnd = new Date(`${firstDate}T${endTime}:00`);
  const durationMs = Math.max(15 * 60000, baseEnd.getTime() - baseStart.getTime());

  const baseIsoList = buildPlanSessionDates(firstDate, time, sessionCount, frequency);
  return baseIsoList.map((scheduledAt, index) => {
    const ov = overrides?.[index];
    if (ov?.date && ov?.time) {
      const localStart = new Date(`${ov.date}T${ov.time}:00`);
      const localEnd = ov.endTime
        ? new Date(`${ov.date}T${ov.endTime}:00`)
        : new Date(localStart.getTime() + durationMs);
      return {
        index,
        scheduledAt: localStart.toISOString(),
        scheduledEndAt: localEnd.toISOString(),
        customized: true,
      };
    }
    const startMs = new Date(scheduledAt).getTime();
    return {
      index,
      scheduledAt,
      scheduledEndAt: new Date(startMs + durationMs).toISOString(),
      customized: false,
    };
  });
}

export function weekdayLabelFromDate(dateYmd: string): string {
  const d = new Date(dateYmd + "T12:00:00");
  return WEEKDAY_NAMES[d.getDay()] ?? "—";
}

export function formatRecurrenceSessionLine(scheduledAt: string): {
  weekdayShort: string;
  date: string;
  time: string;
} {
  const d = new Date(scheduledAt);
  return {
    weekdayShort: WEEKDAY_SHORT[d.getDay()] ?? "—",
    date: d.toLocaleDateString("pt-BR"),
    time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function inferFrequencyLabel(
  slots: { scheduledAt?: string; scheduled_at?: string }[]
): string | null {
  if (slots.length < 2) return null;
  const iso = (s: (typeof slots)[0]) => s.scheduledAt ?? s.scheduled_at ?? "";
  const a = new Date(iso(slots[0])).getTime();
  const b = new Date(iso(slots[1])).getTime();
  const days = Math.round((b - a) / (24 * 60 * 60 * 1000));
  if (days === 7) return "Semanal";
  if (days === 14) return "Quinzenal";
  if (days >= 28 && days <= 31) return "Mensal";
  return null;
}
