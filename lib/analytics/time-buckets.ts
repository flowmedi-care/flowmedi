export type TimeGranularity = "day" | "week" | "month";

export type FunnelPeriod = {
  start: string;
  end: string;
  granularity: TimeGranularity;
};

export const MAX_FUNNEL_RANGE_DAYS = 366;

export function formatLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseLocalDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function getWeekStartMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function bucketKeyFromDate(date: Date, granularity: TimeGranularity): string {
  if (granularity === "day") {
    return formatLocalDateKey(date);
  }
  if (granularity === "week") {
    return formatLocalDateKey(getWeekStartMonday(date));
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function formatBucketLabel(key: string, granularity: TimeGranularity): string {
  if (granularity === "day") {
    return parseLocalDateKey(key).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  }
  if (granularity === "week") {
    const d = parseLocalDateKey(key);
    return `Sem ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
  }
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export function generateBucketKeys(
  start: Date,
  end: Date,
  granularity: TimeGranularity
): string[] {
  const keys: string[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);

  if (granularity === "day") {
    while (cursor <= endDate) {
      keys.push(formatLocalDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return keys;
  }

  if (granularity === "week") {
    let weekStart = getWeekStartMonday(cursor);
    while (weekStart <= endDate) {
      keys.push(formatLocalDateKey(weekStart));
      const next = new Date(weekStart);
      next.setDate(next.getDate() + 7);
      weekStart = next;
    }
    return keys;
  }

  const monthCursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  while (monthCursor <= endDate) {
    keys.push(
      `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, "0")}`
    );
    monthCursor.setMonth(monthCursor.getMonth() + 1);
  }
  return keys;
}

export function parseFunnelPeriodDates(period: FunnelPeriod): { start: Date; end: Date } {
  const start = parseLocalDateKey(period.start);
  start.setHours(0, 0, 0, 0);
  const end = parseLocalDateKey(period.end);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function validateFunnelPeriod(period: FunnelPeriod): string | null {
  const { start, end } = parseFunnelPeriodDates(period);
  if (start > end) return "Data inicial deve ser anterior à final.";
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
  if (diffDays > MAX_FUNNEL_RANGE_DAYS) {
    return `Período máximo de ${MAX_FUNNEL_RANGE_DAYS} dias.`;
  }
  return null;
}

export function getDefaultFunnelPeriod(): FunnelPeriod {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return {
    start: formatLocalDateKey(start),
    end: formatLocalDateKey(end),
    granularity: "day",
  };
}

export function getPresetFunnelPeriod(preset: string): FunnelPeriod {
  const end = new Date();
  const start = new Date();

  switch (preset) {
    case "7d":
      start.setDate(start.getDate() - 6);
      return { start: formatLocalDateKey(start), end: formatLocalDateKey(end), granularity: "day" };
    case "30d":
      start.setDate(start.getDate() - 29);
      return { start: formatLocalDateKey(start), end: formatLocalDateKey(end), granularity: "day" };
    case "90d":
      start.setDate(start.getDate() - 89);
      return {
        start: formatLocalDateKey(start),
        end: formatLocalDateKey(end),
        granularity: "week",
      };
    case "this_month":
      start.setDate(1);
      return { start: formatLocalDateKey(start), end: formatLocalDateKey(end), granularity: "day" };
    case "last_month": {
      start.setMonth(start.getMonth() - 1, 1);
      const lastDay = new Date(end.getFullYear(), end.getMonth(), 0);
      return {
        start: formatLocalDateKey(start),
        end: formatLocalDateKey(lastDay),
        granularity: "day",
      };
    }
    default:
      return getDefaultFunnelPeriod();
  }
}

export function formatPeriodRangeLabel(period: FunnelPeriod): string {
  const start = parseLocalDateKey(period.start);
  const end = parseLocalDateKey(period.end);
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}
