import type { PublicClinicSite } from "@/lib/public-site/types";
import { DAY_LABELS } from "@/lib/public-site/types";
import type { DayKey } from "@/lib/virtual-assistant/types";

const JS_DAY_TO_KEY: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function getTodayHoursLabel(hours: PublicClinicSite["operating_hours"]): string | null {
  const key = JS_DAY_TO_KEY[new Date().getDay()];
  const day = hours[key];
  if (!day || day.closed) return "Fechado hoje";
  const open = day.open ?? "";
  const close = day.close ?? "";
  if (!open || !close) return null;
  return `Hoje: ${open} às ${close}`;
}

export function formatHoursTable(hours: PublicClinicSite["operating_hours"]) {
  const keys = Object.keys(DAY_LABELS) as DayKey[];
  return keys
    .map((key) => {
      const day = hours[key];
      if (!day) return null;
      if (day.closed) {
        return { label: DAY_LABELS[key], value: "Fechado", closed: true };
      }
      const open = day.open ?? "—";
      const close = day.close ?? "—";
      let value = `${open} – ${close}`;
      if (day.lunch_start && day.lunch_end) {
        value += ` · almoço ${day.lunch_start}–${day.lunch_end}`;
      }
      const isToday = JS_DAY_TO_KEY[new Date().getDay()] === key;
      return { label: DAY_LABELS[key], value, closed: false, isToday };
    })
    .filter(Boolean) as {
    label: string;
    value: string;
    closed: boolean;
    isToday?: boolean;
  }[];
}

const SERVICE_ICONS = ["🩺", "💚", "✨", "🌿", "💊", "🫀", "👁️", "🦷"];

export function serviceEmoji(index: number): string {
  return SERVICE_ICONS[index % SERVICE_ICONS.length];
}
