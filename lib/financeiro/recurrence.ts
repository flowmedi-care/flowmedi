import type { RecurrenceEndMode, RecurrenceFrequency } from "./types";

export function addRecurrenceInterval(
  dateStr: string,
  frequency: RecurrenceFrequency,
  intervalCount: number
): string {
  const d = new Date(dateStr + "T12:00:00");
  if (frequency === "daily") {
    d.setDate(d.getDate() + intervalCount);
  } else if (frequency === "weekly") {
    d.setDate(d.getDate() + 7 * intervalCount);
  } else {
    d.setMonth(d.getMonth() + intervalCount);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function generateRecurrenceDates(input: {
  startDate: string;
  frequency: RecurrenceFrequency;
  interval_count: number;
  end_mode: RecurrenceEndMode;
  end_count?: number | null;
  end_date?: string | null;
}): string[] {
  const dates: string[] = [];
  let current = input.startDate;
  const maxIterations = input.end_mode === "never" ? 1 : 500;

  for (let i = 0; i < maxIterations; i++) {
    if (input.end_mode === "until_date" && input.end_date && current > input.end_date) break;
    if (input.end_mode === "count" && input.end_count && dates.length >= input.end_count) break;

    dates.push(current);

    if (input.end_mode === "never" && dates.length >= 1) break;

    current = addRecurrenceInterval(current, input.frequency, input.interval_count);
  }

  return dates;
}

export function countRemainingOccurrences(input: {
  end_mode: RecurrenceEndMode;
  end_count?: number | null;
  generated_count: number;
}): number | null {
  if (input.end_mode === "never") return null;
  if (input.end_mode === "count" && input.end_count) {
    return Math.max(0, input.end_count - input.generated_count);
  }
  return null;
}

export function previewRecurrenceMessage(
  amount: number,
  count: number,
  endMode: RecurrenceEndMode
): string {
  const fmt = amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (endMode === "never") {
    return `Será criada uma série contínua de ${fmt} por ocorrência.`;
  }
  return `Serão criados ${count} lançamentos de ${fmt}.`;
}
