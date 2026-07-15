import type { BookingState, OfferedSlot } from "./types";
import type { SelectionContext, SelectionPeriod } from "./types";

export type SelectionFilters = {
  doctor_id?: string;
  procedure_id?: string;
  date?: string;
  period?: SelectionPeriod;
  duration_minutes?: number | null;
};

function normId(v: string | undefined | null): string | undefined {
  const s = v?.trim();
  return s ? s : undefined;
}

function normPeriod(p: SelectionPeriod | undefined): SelectionPeriod {
  if (p === "manha" || p === "tarde") return p;
  return null;
}

function normDuration(d: number | null | undefined): number | null | undefined {
  if (d === undefined) return undefined;
  if (d == null) return null;
  return Number.isFinite(d) ? d : null;
}

export function filtersEqual(a: SelectionFilters, b: SelectionFilters): boolean {
  return (
    normId(a.doctor_id) === normId(b.doctor_id) &&
    normId(a.procedure_id) === normId(b.procedure_id) &&
    normId(a.date) === normId(b.date) &&
    normPeriod(a.period) === normPeriod(b.period) &&
    (normDuration(a.duration_minutes) ?? null) === (normDuration(b.duration_minutes) ?? null)
  );
}

/** Current filter snapshot from booking (+ optional overrides). */
export function readSelectionFilters(
  booking: BookingState | undefined,
  overrides?: Partial<SelectionFilters>
): SelectionFilters {
  const ctx = booking?.selection_context;
  return {
    doctor_id: overrides?.doctor_id ?? ctx?.doctor_id ?? booking?.doctor_id,
    procedure_id: overrides?.procedure_id ?? ctx?.procedure_id ?? booking?.procedure_id,
    date: overrides?.date ?? ctx?.date ?? booking?.date,
    period:
      overrides && "period" in overrides
        ? normPeriod(overrides.period)
        : normPeriod(ctx?.period),
    duration_minutes:
      overrides && "duration_minutes" in overrides
        ? normDuration(overrides.duration_minutes)
        : normDuration(ctx?.duration_minutes),
  };
}

/**
 * Apply filter updates. If any filter changes: bump version, clear offered_slots /
 * pending_slot / selection_epoch, status collecting. Mirrors top-level doctor/date/…
 */
export function withSelectionFilters(
  booking: BookingState | undefined,
  nextFilters: Partial<SelectionFilters>
): BookingState {
  const base: BookingState = booking ?? { status: "collecting" };
  const prev = readSelectionFilters(base);
  const next: SelectionFilters = {
    doctor_id: nextFilters.doctor_id !== undefined ? nextFilters.doctor_id : prev.doctor_id,
    procedure_id:
      nextFilters.procedure_id !== undefined ? nextFilters.procedure_id : prev.procedure_id,
    date: nextFilters.date !== undefined ? nextFilters.date : prev.date,
    period: "period" in nextFilters ? normPeriod(nextFilters.period) : prev.period,
    duration_minutes:
      "duration_minutes" in nextFilters
        ? normDuration(nextFilters.duration_minutes)
        : prev.duration_minutes,
  };

  const changed = !filtersEqual(prev, next);
  const prevVersion = base.selection_context?.version ?? 0;
  const version = changed ? prevVersion + 1 : Math.max(prevVersion, 1);

  const selection_context: SelectionContext = {
    version: changed ? version : prevVersion || 1,
    doctor_id: normId(next.doctor_id),
    procedure_id: normId(next.procedure_id),
    date: normId(next.date),
    period: normPeriod(next.period),
    duration_minutes: normDuration(next.duration_minutes) ?? null,
  };

  if (!changed && base.selection_context) {
    return {
      ...base,
      doctor_id: selection_context.doctor_id ?? base.doctor_id,
      procedure_id: selection_context.procedure_id ?? base.procedure_id,
      date: selection_context.date ?? base.date,
      selection_context: {
        ...base.selection_context,
        ...selection_context,
        version: base.selection_context.version || 1,
      },
    };
  }

  if (!changed) {
    return {
      ...base,
      doctor_id: selection_context.doctor_id ?? base.doctor_id,
      procedure_id: selection_context.procedure_id ?? base.procedure_id,
      date: selection_context.date ?? base.date,
      selection_context,
    };
  }

  return {
    ...base,
    doctor_id: selection_context.doctor_id,
    procedure_id: selection_context.procedure_id,
    date: selection_context.date,
    offered_slots: undefined,
    pending_slot: undefined,
    selection_epoch: undefined,
    status: "collecting",
    selection_context,
  };
}

/** Slots are valid only when epoch matches current selection_context.version. */
export function getValidOfferedSlots(booking: BookingState | undefined): OfferedSlot[] {
  if (!booking?.offered_slots?.length) return [];
  const version = booking.selection_context?.version;
  if (version == null) {
    // Legacy bookings without context: treat listed slots as valid until first filter write.
    return booking.offered_slots;
  }
  if (booking.selection_epoch !== version) return [];
  return booking.offered_slots;
}

export function hasValidPendingSlot(booking: BookingState | undefined): boolean {
  const pending = booking?.pending_slot?.trim();
  if (!pending) return false;
  const version = booking?.selection_context?.version;
  if (version == null) return true;
  return booking?.selection_epoch === version;
}

/**
 * Stamp offered slots as belonging to the current search filters / version.
 * Aligns selection_context to the search args used.
 */
export function stampOfferedSlots(
  booking: BookingState | undefined,
  slots: OfferedSlot[],
  search: SelectionFilters,
  opts?: { pendingIfSingle?: boolean }
): BookingState {
  const withFilters = withSelectionFilters(booking, {
    doctor_id: search.doctor_id,
    procedure_id: search.procedure_id,
    date: search.date,
    period: search.period ?? null,
    duration_minutes: search.duration_minutes ?? null,
  });
  // withSelectionFilters may have cleared slots if filters changed — restore with epoch.
  const version = withFilters.selection_context?.version ?? 1;
  const single = opts?.pendingIfSingle && slots.length === 1;
  return {
    ...withFilters,
    date: search.date ?? withFilters.date,
    offered_slots: slots,
    pending_slot: single ? slots[0]!.scheduled_at : undefined,
    selection_epoch: version,
    status: single ? "confirming" : "collecting",
    selection_context: {
      version,
      doctor_id: normId(search.doctor_id) ?? withFilters.selection_context?.doctor_id,
      procedure_id: normId(search.procedure_id) ?? withFilters.selection_context?.procedure_id,
      date: normId(search.date) ?? withFilters.selection_context?.date,
      period: normPeriod(search.period),
      duration_minutes: normDuration(search.duration_minutes) ?? null,
    },
  };
}

/** When selecting a pending slot from a valid list, keep epoch. */
export function withPendingSlot(
  booking: BookingState | undefined,
  scheduledAt: string
): BookingState {
  const base = booking ?? { status: "confirming" };
  const version = base.selection_context?.version;
  return {
    ...base,
    pending_slot: scheduledAt,
    status: "confirming",
    selection_epoch: version ?? base.selection_epoch,
  };
}
