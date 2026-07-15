import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppointmentPolicy,
  AppointmentPolicyInput,
  CheckInPolicy,
} from "@/lib/attendance-flow/types";
import type { DomainMutationResult } from "@/lib/domain/mutation-result";
import {
  CANCELABLE_APPOINTMENT_STATUSES,
  mapListedAppointmentRows,
  type ListAppointmentRow,
} from "./list-appointments-trace";

export type CheckInSource =
  | "assistant"
  | "dashboard"
  | "reception"
  | "kiosk"
  | "api";

export type CheckInAppointmentSummary = {
  id: string;
  scheduled_at: string;
  status: string;
  doctor_id?: string | null;
  procedure_id?: string | null;
  doctor_name: string | null;
  procedure_name: string | null;
  valor: number | null;
  patient_id?: string;
  checked_in_at?: string | null;
};

export type ListCheckInResult =
  | { type: "SUCCESS"; appointments: CheckInAppointmentSummary[] }
  | { type: "DISABLED" }
  | { type: "TOO_EARLY"; nextEligibleAt: string }
  | { type: "NO_ELIGIBLE_APPOINTMENTS" };

export type PerformCheckInSuccess = {
  appointmentId: string;
  checkedInAt: string;
};

export type PerformCheckInResult = DomainMutationResult<PerformCheckInSuccess>;

const CHECK_IN_SELECT =
  "id, scheduled_at, status, valor, patient_id, doctor_id, procedure_id, checked_in_at, doctor:profiles!appointments_doctor_id_fkey(full_name), procedure:procedures!procedure_id(name)";

export function resolveCheckInPolicy(
  policy: AppointmentPolicy | AppointmentPolicyInput | null | undefined
): CheckInPolicy {
  const defaults: CheckInPolicy = {
    enabled: false,
    window: { opens_before_hours: 2, closes_after_minutes: 30 },
  };
  const stored = policy?.check_in;
  return {
    enabled: stored?.enabled ?? defaults.enabled,
    window: {
      opens_before_hours:
        stored?.window?.opens_before_hours ?? defaults.window.opens_before_hours,
      closes_after_minutes:
        stored?.window?.closes_after_minutes ?? defaults.window.closes_after_minutes,
    },
  };
}

function windowBounds(
  scheduledAtIso: string,
  checkIn: CheckInPolicy
): { opensAt: Date; closesAt: Date } {
  const scheduled = new Date(scheduledAtIso);
  const opensAt = new Date(
    scheduled.getTime() - checkIn.window.opens_before_hours * 60 * 60 * 1000
  );
  const closesAt = new Date(
    scheduled.getTime() + checkIn.window.closes_after_minutes * 60 * 1000
  );
  return { opensAt, closesAt };
}

export type WindowEligibility =
  | { type: "IN_WINDOW" }
  | { type: "TOO_EARLY"; nextEligibleAt: string }
  | { type: "WINDOW_CLOSED" };

export function evaluateCheckInWindow(
  scheduledAtIso: string,
  checkIn: CheckInPolicy,
  now: Date = new Date()
): WindowEligibility {
  const { opensAt, closesAt } = windowBounds(scheduledAtIso, checkIn);
  if (now.getTime() < opensAt.getTime()) {
    return { type: "TOO_EARLY", nextEligibleAt: opensAt.toISOString() };
  }
  if (now.getTime() > closesAt.getTime()) {
    return { type: "WINDOW_CLOSED" };
  }
  return { type: "IN_WINDOW" };
}

function toSummary(row: ListAppointmentRow & { checked_in_at?: string | null }): CheckInAppointmentSummary {
  return {
    id: row.id,
    scheduled_at: row.scheduled_at,
    status: row.status,
    doctor_id: row.doctor_id ?? null,
    procedure_id: row.procedure_id ?? null,
    doctor_name: row.doctor_name ?? null,
    procedure_name: row.procedure_name ?? null,
    valor: row.valor ?? null,
    patient_id: row.patient_id,
    checked_in_at: row.checked_in_at ?? null,
  };
}

export async function listAppointmentsForCheckIn(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    patientId: string;
    policy: AppointmentPolicy | AppointmentPolicyInput | null | undefined;
    now?: Date;
  }
): Promise<ListCheckInResult> {
  const checkIn = resolveCheckInPolicy(opts.policy);
  if (!checkIn.enabled) return { type: "DISABLED" };

  const now = opts.now ?? new Date();
  // Look back past the close window so WINDOW_CLOSED candidates are classified correctly.
  const lookbackMs = Math.max(checkIn.window.closes_after_minutes, 60) * 60 * 1000;
  const fromIso = new Date(now.getTime() - lookbackMs).toISOString();

  const { data, error } = await supabase
    .from("appointments")
    .select(CHECK_IN_SELECT)
    .eq("clinic_id", opts.clinicId)
    .eq("patient_id", opts.patientId)
    .in("status", [...CANCELABLE_APPOINTMENT_STATUSES])
    .gte("scheduled_at", fromIso)
    .order("scheduled_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("[listAppointmentsForCheckIn] query failed:", error.message);
    return { type: "NO_ELIGIBLE_APPOINTMENTS" };
  }

  const rawRows = (data ?? []) as Array<{
    id: string;
    scheduled_at: string;
    status: string;
    valor?: number | null;
    patient_id?: string | null;
    doctor_id?: string | null;
    procedure_id?: string | null;
    checked_in_at?: string | null;
    doctor?: { full_name: string } | { full_name: string }[] | null;
    procedure?: { name: string } | { name: string }[] | null;
  }>;
  const checkedInById = new Map(
    rawRows.map((r) => [String(r.id), r.checked_in_at ?? null] as const)
  );
  const rows = mapListedAppointmentRows(rawRows, opts.patientId).map((row) => ({
    ...row,
    checked_in_at: checkedInById.get(row.id) ?? null,
  }));

  const eligible: CheckInAppointmentSummary[] = [];
  let earliestOpen: string | null = null;

  for (const row of rows) {
    if (row.checked_in_at) continue;
    const window = evaluateCheckInWindow(row.scheduled_at, checkIn, now);
    if (window.type === "IN_WINDOW") {
      eligible.push(toSummary(row));
      continue;
    }
    if (window.type === "TOO_EARLY") {
      if (!earliestOpen || window.nextEligibleAt < earliestOpen) {
        earliestOpen = window.nextEligibleAt;
      }
    }
  }

  if (eligible.length > 0) {
    return { type: "SUCCESS", appointments: eligible };
  }
  if (earliestOpen) {
    return { type: "TOO_EARLY", nextEligibleAt: earliestOpen };
  }
  return { type: "NO_ELIGIBLE_APPOINTMENTS" };
}

export async function performCheckIn(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    appointmentId: string;
    patientId: string;
    policy: AppointmentPolicy | AppointmentPolicyInput | null | undefined;
    source: CheckInSource;
    actorPatientId?: string | null;
    now?: Date;
  }
): Promise<PerformCheckInResult> {
  const checkIn = resolveCheckInPolicy(opts.policy);
  if (!checkIn.enabled) {
    return { type: "NOT_ALLOWED", reason: "DISABLED" };
  }

  const now = opts.now ?? new Date();

  const { data: appt, error } = await supabase
    .from("appointments")
    .select("id, patient_id, status, scheduled_at, checked_in_at")
    .eq("id", opts.appointmentId)
    .eq("clinic_id", opts.clinicId)
    .maybeSingle();

  if (error || !appt) return { type: "NOT_FOUND" };
  if (String(appt.patient_id) !== opts.patientId) return { type: "NOT_FOUND" };

  if (appt.checked_in_at) {
    return {
      type: "ALREADY_DONE",
      data: {
        appointmentId: String(appt.id),
        checkedInAt: String(appt.checked_in_at),
      },
    };
  }

  if (!CANCELABLE_APPOINTMENT_STATUSES.includes(appt.status as "agendada" | "confirmada")) {
    return { type: "NOT_ALLOWED", reason: "NOT_ELIGIBLE" };
  }

  const window = evaluateCheckInWindow(String(appt.scheduled_at), checkIn, now);
  if (window.type === "TOO_EARLY") {
    return {
      type: "NOT_ALLOWED",
      reason: "TOO_EARLY",
      nextEligibleAt: window.nextEligibleAt,
    };
  }
  if (window.type === "WINDOW_CLOSED") {
    return { type: "NOT_ALLOWED", reason: "WINDOW_CLOSED" };
  }

  const checkedInAt = now.toISOString();
  const actorId = opts.actorPatientId?.trim() || opts.patientId;

  const { error: updateError } = await supabase
    .from("appointments")
    .update({
      checked_in_at: checkedInAt,
      check_in_source: opts.source,
      checked_in_by_patient_id: actorId,
      updated_at: checkedInAt,
    })
    .eq("id", opts.appointmentId)
    .eq("clinic_id", opts.clinicId)
    .is("checked_in_at", null);

  if (updateError) {
    console.error("[performCheckIn] update failed:", updateError.message);
    return { type: "NOT_ALLOWED", reason: "NOT_ELIGIBLE" };
  }

  // Race: another writer may have checked in — re-read.
  const { data: after } = await supabase
    .from("appointments")
    .select("checked_in_at")
    .eq("id", opts.appointmentId)
    .maybeSingle();

  if (!after?.checked_in_at) {
    return { type: "NOT_ALLOWED", reason: "NOT_ELIGIBLE" };
  }

  const finalAt = String(after.checked_in_at);
  if (finalAt !== checkedInAt) {
    return {
      type: "ALREADY_DONE",
      data: { appointmentId: opts.appointmentId, checkedInAt: finalAt },
    };
  }

  return {
    type: "SUCCESS",
    data: { appointmentId: opts.appointmentId, checkedInAt: finalAt },
  };
}
