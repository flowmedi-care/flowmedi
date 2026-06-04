// FINANCEIRO FASE 1 — utilitários de período

export function getMonthPeriod(year: number, month: number) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end, startIso: start.toISOString(), endIso: end.toISOString() };
}

export function getCurrentMonthYear() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function parseMonthYear(searchParams: { year?: string; month?: string }) {
  const { year: cy, month: cm } = getCurrentMonthYear();
  const year = searchParams.year ? parseInt(searchParams.year, 10) : cy;
  const month = searchParams.month ? parseInt(searchParams.month, 10) : cm;
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return getCurrentMonthYear();
  }
  return { year, month };
}

export function formatMonthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

export function daysBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function daysOpenSince(isoDate: string) {
  const start = new Date(isoDate);
  const now = new Date();
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.max(0, daysBetween(start, now));
}

export function toDateOnly(iso: string | null | undefined) {
  if (!iso) return null;
  return iso.slice(0, 10);
}

export function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysDateOnly(dateOnly: string, days: number) {
  const d = new Date(dateOnly + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
