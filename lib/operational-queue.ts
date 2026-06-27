/** Shared helpers for fila operacional (−7d … +14d). */

export function getOperacionalRange() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setDate(end.getDate() + 14);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function toDayKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isToday(date: Date | string): boolean {
  return toDayKey(date) === toDayKey(new Date());
}

export function formatDayHeader(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  const formatted = date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: y !== today.getFullYear() ? "numeric" : undefined,
  });

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return `Amanhã · ${formatted}`;
  if (diffDays === -1) return `Ontem · ${formatted}`;
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function groupRowsByDay<T extends { scheduled_at: string }>(
  rows: T[]
): { dayKey: string; rows: T[] }[] {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = toDayKey(row.scheduled_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dayKey, dayRows]) => ({
      dayKey,
      rows: [...dayRows].sort(
        (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      ),
    }));
}
