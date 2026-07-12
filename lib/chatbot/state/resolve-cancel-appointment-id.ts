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
 * Resolve Reference — pure.
 * Transforms an explicit tool arg into a canonical appointment UUID.
 * No conversational state. No allowlist.
 *
 * `appointment_id` means: domain UUID | 1-based list index into `activeAppointments`.
 * Idempotent: resolveReference(UUID) = UUID; resolveReference(resolveReference(x)) = resolveReference(x).
 */
export function resolveReference(
  arg: unknown,
  activeAppointments: readonly string[]
): string | null {
  const raw =
    arg != null && String(arg).trim() !== "" ? String(arg).trim() : "";
  if (!raw) return null;

  if (isEntityUuid(raw)) return raw;

  const index = parseListIndex(raw);
  if (index == null) return null;

  const active = activeAppointments.map((id) => String(id).trim()).filter(Boolean);
  if (index < 1 || index > active.length) return null;

  return active[index - 1] ?? null;
}

/** 1-based list index from a numeric string (e.g. "2", "02"). Rejects non-integers. */
function parseListIndex(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n)) return null;
  return n;
}

/**
 * Authorize Target — "May this UUID be used in this context?"
 * `allowedAppointments` is parameterized by the caller (today: active ∪ focused).
 */
export function authorizeTarget(
  uuid: string,
  allowedAppointments: ReadonlySet<string> | readonly string[],
  opts: {
    patientId?: string | null;
    pendingSlot?: string | null;
  } = {}
): CancelAppointmentIdResult {
  const candidate = uuid.trim();
  if (!candidate) {
    return { ok: false, reason: "missing" };
  }

  const patientId = opts.patientId?.trim() || "";
  const pendingSlot = opts.pendingSlot?.trim() || "";

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

  const allowed =
    allowedAppointments instanceof Set
      ? allowedAppointments
      : new Set(
          [...allowedAppointments].map((id) => String(id).trim()).filter(Boolean)
        );

  if (allowed.size === 0 || !allowed.has(candidate)) {
    return { ok: false, reason: "not_domain_reference" };
  }

  return { ok: true, appointmentId: candidate };
}

/**
 * Orchestrator: resolveReference(arg) ?? focused → authorizeTarget.
 * Focused is state fallback — not part of Resolve Reference.
 *
 * Postcondition: canonical appointment UUID or typed error.
 * Never returns list indices or partially resolved identifiers.
 */
export function resolveCancelAppointmentId(
  args: Record<string, unknown>,
  aiState: AiState
): CancelAppointmentIdResult {
  const patientId = aiState.patient_id?.trim() || "";
  const pendingSlot = aiState.booking?.pending_slot?.trim() || "";
  const focusedRaw = aiState.focused_appointment_id?.trim() || "";
  const focused = focusedRaw && isEntityUuid(focusedRaw) ? focusedRaw : "";
  const active = (aiState.active_appointments ?? [])
    .map((id) => String(id).trim())
    .filter(Boolean);

  const rawArg =
    args.appointment_id != null && String(args.appointment_id).trim() !== ""
      ? String(args.appointment_id).trim()
      : "";

  const fromArg = resolveReference(args.appointment_id, active);

  // Explicit non-domain shapes must not fall through to focused.
  if (rawArg && !fromArg) {
    if (
      ISO_DATETIME_RE.test(rawArg) ||
      (pendingSlot && rawArg === pendingSlot)
    ) {
      return { ok: false, reason: "from_pending_slot" };
    }
  }

  const canonical = fromArg ?? (focused || null);

  if (!canonical) {
    return { ok: false, reason: "missing" };
  }

  const allowed = new Set<string>(active);
  if (focused && focused !== patientId) {
    allowed.add(focused);
  }

  return authorizeTarget(canonical, allowed, { patientId, pendingSlot });
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

/**
 * Refresh invariant: a collection refresh must not invalidate a reference
 * still present in the new collection.
 */
export function focusedAfterAppointmentListRefresh(
  ids: readonly string[],
  currentFocused?: string | null
): string | undefined {
  if (ids.length === 1) return ids[0];
  const focus = currentFocused?.trim() || "";
  if (focus && ids.includes(focus)) return focus;
  return undefined;
}
