/** Observability-only — never part of the functional list tool payload. */

export const CANCELABLE_APPOINTMENT_STATUSES = ["agendada", "confirmada"] as const;

export type ListAppointmentRow = {
  id: string;
  scheduled_at: string;
  status: string;
  patient_id?: string;
  doctor_name?: string | null;
  procedure_name?: string | null;
  valor?: number | null;
};

export type ListExecutionTrace = {
  clinicId: string;
  phone: string;
  matchedPatientIds: string[];
  patientsMatchedByPhone: number;
  selectedPatientId: string;
  resolvedPatientId: string;
  usedPhoneFallback: boolean;
  effectiveFilters: {
    statuses: string[];
    upcomingOnly: boolean;
  };
  stages: {
    beforeFilters: number;
    afterStatusFilter: number;
    afterDateFilter: number;
    resultCount: number;
  };
  counts: {
    totalForSelectedPatient: number;
    cancelable: number;
    upcomingCancelable: number;
    overdueCancelable: number;
  };
};

export type ListEmptyDiagnosis =
  | "patient_not_found"
  | "no_appointments_for_patient"
  | "none_cancelable_status"
  | "all_cancelable_are_overdue"
  | "empty_after_filters";

/** Debug/replay classifier — not used by domain service return type. */
export function classifyListEmptyDiagnosis(
  trace: ListExecutionTrace
): ListEmptyDiagnosis | null {
  if (trace.stages.resultCount > 0) return null;
  if (trace.patientsMatchedByPhone === 0 && !trace.selectedPatientId) {
    return "patient_not_found";
  }
  if (trace.counts.totalForSelectedPatient === 0 && !trace.usedPhoneFallback) {
    return "no_appointments_for_patient";
  }
  if (trace.counts.cancelable === 0 && trace.counts.totalForSelectedPatient > 0) {
    return "none_cancelable_status";
  }
  if (
    trace.effectiveFilters.upcomingOnly &&
    trace.counts.upcomingCancelable === 0 &&
    trace.counts.overdueCancelable > 0
  ) {
    return "all_cancelable_are_overdue";
  }
  return "empty_after_filters";
}

/**
 * Recovery order when primary upcoming is empty.
 * Proven bug: overdue on primary was skipped whenever phone siblings existed.
 */
export function resolveListRecoverySource(input: {
  primaryUpcoming: number;
  primaryOverdue: number;
  siblingUpcoming: number;
  siblingOverdue: number;
}):
  | "primary_upcoming"
  | "primary_overdue"
  | "sibling_upcoming"
  | "sibling_overdue"
  | "empty" {
  if (input.primaryUpcoming > 0) return "primary_upcoming";
  if (input.primaryOverdue > 0) return "primary_overdue";
  if (input.siblingUpcoming > 0) return "sibling_upcoming";
  if (input.siblingOverdue > 0) return "sibling_overdue";
  return "empty";
}

export function isCancelableStatus(status: string): boolean {
  return (CANCELABLE_APPOINTMENT_STATUSES as readonly string[]).includes(status);
}

/** Pure stage filters — unit-testable replay of filter layers. */
export function applyListAppointmentStages(
  rows: ListAppointmentRow[],
  opts: { upcomingOnly: boolean; nowIso?: string }
): {
  afterStatus: ListAppointmentRow[];
  afterDate: ListAppointmentRow[];
  counts: ListExecutionTrace["counts"];
} {
  const now = opts.nowIso ?? new Date().toISOString();
  const afterStatus = rows.filter((r) => isCancelableStatus(String(r.status)));
  const upcoming = afterStatus.filter((r) => r.scheduled_at >= now);
  const overdue = afterStatus.filter((r) => r.scheduled_at < now);
  const afterDate = opts.upcomingOnly ? upcoming : afterStatus;
  return {
    afterStatus,
    afterDate,
    counts: {
      totalForSelectedPatient: rows.length,
      cancelable: afterStatus.length,
      upcomingCancelable: upcoming.length,
      overdueCancelable: overdue.length,
    },
  };
}
