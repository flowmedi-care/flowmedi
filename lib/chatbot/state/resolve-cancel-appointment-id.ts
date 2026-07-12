import type { AiState } from "./types";
import { isEntityUuid } from "./resolve-entity-id";

const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export type CancelAppointmentIdFailure =
  | "missing"
  | "from_patient_id"
  | "from_pending_slot"
  | "not_domain_reference";

export type CancelAppointmentIdResult =
  | { ok: true; appointmentId: string }
  | { ok: false; reason: CancelAppointmentIdFailure };

/**
 * Cancel contract: appointment_id must come from a validated domain reference
 * (list result / focused / active), never patient_id or pending_slot.
 */
export function resolveCancelAppointmentId(
  args: Record<string, unknown>,
  aiState: AiState
): CancelAppointmentIdResult {
  const patientId = aiState.patient_id?.trim() || "";
  const pendingSlot = aiState.booking?.pending_slot?.trim() || "";
  const focused = aiState.focused_appointment_id?.trim() || "";
  const active = (aiState.active_appointments ?? []).map((id) => String(id).trim()).filter(Boolean);

  const rawArg =
    args.appointment_id != null && String(args.appointment_id).trim() !== ""
      ? String(args.appointment_id).trim()
      : "";

  const candidate =
    rawArg ||
    focused ||
    (active.length === 1 ? active[0] : "");

  if (!candidate) {
    return { ok: false, reason: "missing" };
  }

  if (patientId && candidate === patientId) {
    return { ok: false, reason: "from_patient_id" };
  }

  if (
    ISO_DATETIME_RE.test(candidate) ||
    (pendingSlot && candidate === pendingSlot)
  ) {
    return { ok: false, reason: "from_pending_slot" };
  }

  if (!isEntityUuid(candidate)) {
    return { ok: false, reason: "not_domain_reference" };
  }

  const allowed = new Set<string>(active);
  if (focused && isEntityUuid(focused) && focused !== patientId) {
    allowed.add(focused);
  }

  // Args may repeat a validated focus/active id.
  if (allowed.size > 0 && !allowed.has(candidate)) {
    return { ok: false, reason: "not_domain_reference" };
  }

  // No focus/active yet: refuse bare LLM invent (must list first).
  if (allowed.size === 0) {
    return { ok: false, reason: "not_domain_reference" };
  }

  return { ok: true, appointmentId: candidate };
}

export function cancelAppointmentIdFailureMessage(
  reason: CancelAppointmentIdFailure
): string {
  switch (reason) {
    case "from_patient_id":
      return "appointment_id inválido (id do paciente). Chame list_patient_appointments e use o id da consulta.";
    case "from_pending_slot":
      return "appointment_id inválido (horário/slot). Chame list_patient_appointments e use o id da consulta.";
    case "not_domain_reference":
      return "Consulta não identificada. Chame list_patient_appointments e peça ao paciente escolher.";
    default:
      return "Consulta não identificada. Chame list_patient_appointments antes.";
  }
}
