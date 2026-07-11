import type { ToolOption } from "@/lib/chatbot/tools/types";

export type Period = "manha" | "tarde";

export type DayOption = {
  index: number;
  date: string;
  label: string;
  periods: Period[];
  periodsLabel: string;
  slotCount?: number;
};

export type TimeOption = {
  index: number;
  scheduledAt: string;
  label: string;
  period: Period;
  isPast: boolean;
};

export type ToolResultLike = {
  status?: string;
  data?: Record<string, unknown>;
  options?: ToolOption[];
};

const PERIOD_LABELS: Record<Period, string> = {
  manha: "Manhã",
  tarde: "Tarde",
};

function formatPeriodsLabel(periods: Period[]): string {
  if (!periods.length) return "";
  return periods.map((p) => PERIOD_LABELS[p]).join(" · ");
}

function stripIndexPrefix(label: string): string {
  return label.replace(/^\d+\.\s*/, "").trim();
}

function parsePeriodFromLabel(label: string): Period | null {
  const lower = label.toLowerCase();
  if (lower.includes("manhã") || lower.includes("manha")) {
    if (lower.includes("tarde")) return null;
    return "manha";
  }
  if (lower.includes("tarde")) return "tarde";
  return null;
}

function hourFromIso(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours();
}

function inferPeriodFromIso(iso: string): Period {
  const h = hourFromIso(iso);
  if (h == null) return "manha";
  return h < 12 ? "manha" : "tarde";
}

function isToday(dateStr: string): boolean {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return dateStr === `${y}-${m}-${d}`;
}

function isPastTime(scheduledAt: string, dateStr: string): boolean {
  if (!isToday(dateStr)) return false;
  const slot = new Date(scheduledAt);
  if (Number.isNaN(slot.getTime())) return false;
  return slot.getTime() <= Date.now();
}

function extractTimeLabel(scheduledAt: string, optionLabel?: string): string {
  if (optionLabel && /^\d{1,2}:\d{2}$/.test(optionLabel.trim())) {
    return optionLabel.trim();
  }
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return scheduledAt;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function parseDaysFromResult(result: unknown): DayOption[] {
  if (!result || typeof result !== "object") return [];
  const r = result as ToolResultLike;
  const options = r.options ?? [];
  const daysData = Array.isArray(r.data?.days)
    ? (r.data.days as Array<{
        date: string;
        label: string;
        periods?: string[];
        periods_label?: string;
      }>)
    : [];

  const dayMeta = new Map(
    daysData.map((d) => [
      d.date,
      {
        periods: (d.periods ?? []).filter(
          (p): p is Period => p === "manha" || p === "tarde"
        ),
        periodsLabel: d.periods_label ?? "",
      },
    ])
  );

  if (options.length > 0) {
    return options.map((opt, i) => {
      const meta = dayMeta.get(opt.id);
      const periods = meta?.periods?.length
        ? meta.periods
        : (() => {
            const fromLabel = parsePeriodFromLabel(opt.label);
            if (fromLabel) return [fromLabel];
            return ["manha", "tarde"] as Period[];
          })();
      return {
        index: opt.index ?? i + 1,
        date: opt.id,
        label: stripIndexPrefix(opt.label).replace(/\s*\([^)]*\)\s*$/, "").trim() || opt.label,
        periods,
        periodsLabel: meta?.periodsLabel || formatPeriodsLabel(periods),
      };
    });
  }

  return daysData.map((d, i) => {
    const periods = (d.periods ?? []).filter(
      (p): p is Period => p === "manha" || p === "tarde"
    );
    return {
      index: i + 1,
      date: d.date,
      label: d.label,
      periods,
      periodsLabel: d.periods_label || formatPeriodsLabel(periods),
    };
  });
}

export function parseDaysFromAiState(aiState: Record<string, unknown>): DayOption[] {
  const offered = aiState.offered_days;
  if (!Array.isArray(offered)) return [];
  return offered.map((item, i) => {
    const d = item as { date?: string; label?: string; index?: number };
    if (!d.date) return null;
    return {
      index: d.index ?? i + 1,
      date: d.date,
      label: d.label ?? d.date,
      periods: ["manha", "tarde"] as Period[],
      periodsLabel: "Manhã · Tarde",
    };
  }).filter(Boolean) as DayOption[];
}

export function parseTimesFromResult(
  result: unknown,
  selectedDate: string,
  hidePast = true
): TimeOption[] {
  if (!result || typeof result !== "object") return [];
  const r = result as ToolResultLike;
  const options = r.options ?? [];

  let times: TimeOption[] = [];

  if (options.length > 0) {
    times = options.map((opt, i) => {
      const scheduledAt = opt.id;
      const period = inferPeriodFromIso(scheduledAt);
      return {
        index: opt.index ?? i + 1,
        scheduledAt,
        label: extractTimeLabel(scheduledAt, opt.label),
        period,
        isPast: isPastTime(scheduledAt, selectedDate),
      };
    });
  } else if (Array.isArray(r.data?.slots)) {
    const slots = r.data.slots as Array<{
      scheduled_at: string;
      label?: string;
      display?: string;
    }>;
    times = slots.map((s, i) => {
      const period = inferPeriodFromIso(s.scheduled_at);
      return {
        index: i + 1,
        scheduledAt: s.scheduled_at,
        label: extractTimeLabel(s.scheduled_at, s.label ?? s.display),
        period,
        isPast: isPastTime(s.scheduled_at, selectedDate),
      };
    });
  }

  if (hidePast) {
    times = times.filter((t) => !t.isPast);
  }

  return times;
}

export function parseTimesFromAiState(
  aiState: Record<string, unknown>,
  selectedDate: string,
  hidePast = true
): TimeOption[] {
  const booking = aiState.booking as { offered_slots?: Array<{ scheduled_at: string; display?: string }> } | undefined;
  const slots = booking?.offered_slots ?? (Array.isArray(aiState.offered_slots) ? aiState.offered_slots : []);
  if (!Array.isArray(slots)) return [];

  let times = slots.map((s, i) => {
    const slot = s as { scheduled_at: string; display?: string; label?: string };
    return {
      index: i + 1,
      scheduledAt: slot.scheduled_at,
      label: extractTimeLabel(slot.scheduled_at, slot.display ?? slot.label),
      period: inferPeriodFromIso(slot.scheduled_at),
      isPast: isPastTime(slot.scheduled_at, selectedDate),
    };
  });

  if (hidePast) times = times.filter((t) => !t.isPast);
  return times;
}

export function groupTimesByPeriod(times: TimeOption[]): Record<Period, TimeOption[]> {
  return {
    manha: times.filter((t) => t.period === "manha"),
    tarde: times.filter((t) => t.period === "tarde"),
  };
}

export function getHasMoreDays(result: unknown): { hasMore: boolean; nextSkipDays: number } {
  if (!result || typeof result !== "object") {
    return { hasMore: false, nextSkipDays: 0 };
  }
  const data = (result as ToolResultLike).data;
  return {
    hasMore: Boolean(data?.has_more),
    nextSkipDays: Number(data?.next_skip_days) || 0,
  };
}

export function formatDayTimeSummary(date: string, timeLabel: string, dayLabel?: string): string {
  const day = dayLabel ?? date;
  return `${day} às ${timeLabel}`;
}

export { PERIOD_LABELS, isToday, isPastTime };
