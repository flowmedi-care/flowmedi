/**
 * Helpers para agenda: semana começa na segunda-feira (padrão BR).
 */

/** Segunda = 0 (JS domingo = 0). Ajuste para que segunda seja o primeiro dia da semana. */
function getMondayOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getStartOfWeek(d: Date): Date {
  const m = getMondayOfWeek(d);
  return new Date(m.getFullYear(), m.getMonth(), m.getDate(), 0, 0, 0, 0);
}

export function getEndOfWeek(d: Date): Date {
  const start = getStartOfWeek(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/** Retorna as 7 datas (seg a dom) da semana que contém `d`. */
export function getWeekDates(d: Date): Date[] {
  const start = getStartOfWeek(d);
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(start);
    x.setDate(x.getDate() + i);
    dates.push(x);
  }
  return dates;
}

export function getStartOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function getEndOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** Retorna um array de semanas do mês; cada semana é um array de 7 Date | null (null = dia fora do mês). */
export function getMonthCalendarGrid(d: Date): (Date | null)[][] {
  const start = getStartOfMonth(d);
  const end = getEndOfMonth(d);
  const firstMonday = getStartOfWeek(start);
  const weeks: (Date | null)[][] = [];
  let current = new Date(firstMonday);

  while (current <= end || weeks.length === 0) {
    const week: (Date | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(current);
      day.setDate(current.getDate() + i);
      week.push(day.getMonth() === d.getMonth() ? day : null);
    }
    weeks.push(week);
    current.setDate(current.getDate() + 7);
    if (current > end && weeks.length >= 1) break;
  }
  return weeks;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addWeeks(d: Date, n: number): Date {
  return addDays(d, n * 7);
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Data local em YYYY-MM-DD (evita bug de UTC em fusos como Brasil). */
export function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatWeekRange(startOfWeek: Date): string {
  const end = addDays(startOfWeek, 6);
  const fmt = (x: Date) =>
    x.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return `${fmt(startOfWeek)} – ${fmt(end)}`;
}

export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function formatDayShort(d: Date): string {
  return d.toLocaleDateString("pt-BR", { weekday: "short" });
}

/** Horas no dia para grade (ex.: 7–20). */
export function getHourSlots(startHour = 7, endHour = 20): number[] {
  const slots: number[] = [];
  for (let h = startHour; h <= endHour; h++) slots.push(h);
  return slots;
}

/** Retorna o número da semana no mês (1–5) e intervalo dd-dd. Ex: Semana 1 (01-07). */
export function getWeekOfMonthLabel(d: Date): { weekNum: number; label: string } {
  const day = d.getDate();
  const weekNum = Math.ceil(day / 7);
  const startDay = (weekNum - 1) * 7 + 1;
  const endDay = Math.min(weekNum * 7, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
  const label = `Semana ${weekNum} (${String(startDay).padStart(2, "0")}-${String(endDay).padStart(2, "0")})`;
  return { weekNum, label };
}

/** Itera os dias entre start e end (inclusive). */
export function iterateDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endNorm = new Date(end);
  endNorm.setHours(23, 59, 59, 999);
  while (cur <= endNorm) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/** Para granularidade semana: sempre começa na segunda anterior ao início. */
export function getWeekStartForPeriod(start: Date): Date {
  return getStartOfWeek(start);
}

/** Converte data local para ISO string preservando o dia (evita problemas de timezone). */
export function localDateToISO(year: number, month: number, day: number, hour: number, minute: number): string {
  // Criar data local às 12:00 (meio-dia) para evitar problemas de timezone
  // Meio-dia raramente muda de dia quando convertido para UTC
  const localDate = new Date(year, month - 1, day, 12, 0, 0, 0);
  // Ajustar para a hora desejada preservando o dia
  localDate.setHours(hour, minute, 0, 0);
  // Verificar se o dia mudou após setHours (pode acontecer em edge cases)
  // Se mudou, usar meio-dia e ajustar manualmente
  if (localDate.getDate() !== day || localDate.getMonth() !== month - 1) {
    // Se o dia mudou, criar novamente com hora segura
    const safeDate = new Date(year, month - 1, day, 12, 0, 0, 0);
    // Ajustar hora preservando o dia
    safeDate.setHours(hour, minute, 0, 0);
    return safeDate.toISOString();
  }
  return localDate.toISOString();
}
