import type { AiState, BookingState, ConversationFlowState, OfferedSlot } from "./types";
import { initialAiState } from "./types";

type LegacyRaw = Record<string, unknown>;

export function normalizeAiState(raw: LegacyRaw | null | undefined): AiState {
  if (!raw || typeof raw !== "object") return initialAiState();

  const base: AiState = {
    patient_id: raw.patient_id ? String(raw.patient_id) : undefined,
    offered_doctors: Array.isArray(raw.offered_doctors)
      ? (raw.offered_doctors as AiState["offered_doctors"])
      : undefined,
    offered_procedures: Array.isArray(raw.offered_procedures)
      ? (raw.offered_procedures as AiState["offered_procedures"])
      : undefined,
    offered_days: Array.isArray(raw.offered_days)
      ? (raw.offered_days as AiState["offered_days"])
      : undefined,
    active_selection:
      raw.active_selection && typeof raw.active_selection === "object"
        ? (raw.active_selection as AiState["active_selection"])
        : undefined,
    pending_active_selection:
      raw.pending_active_selection && typeof raw.pending_active_selection === "object"
        ? (raw.pending_active_selection as AiState["pending_active_selection"])
        : undefined,
    focused_appointment_id: raw.focused_appointment_id
      ? String(raw.focused_appointment_id)
      : undefined,
    active_appointments: Array.isArray(raw.active_appointments)
      ? raw.active_appointments.map(String)
      : undefined,
    booking_fork:
      raw.booking_fork && typeof raw.booking_fork === "object"
        ? (() => {
            const status = (raw.booking_fork as { status?: string }).status;
            if (
              status === "awaiting_choice" ||
              status === "new" ||
              status === "alter"
            ) {
              return { status };
            }
            return undefined;
          })()
        : undefined,
    consecutive_tool_failures: Number(raw.consecutive_tool_failures) || 0,
    confidence:
      raw.confidence && typeof raw.confidence === "object"
        ? (() => {
            const c = raw.confidence as {
              level?: string;
              consecutive_failures?: number;
            };
            const level = c.level;
            if (
              level === "high" ||
              level === "low" ||
              level === "recovering" ||
              level === "handoff"
            ) {
              return {
                level,
                consecutive_failures: Math.max(
                  0,
                  Number(c.consecutive_failures) || 0
                ),
              };
            }
            return undefined;
          })()
        : undefined,
    ai_processing_started_at: raw.ai_processing_started_at
      ? String(raw.ai_processing_started_at)
      : undefined,
    pending_transcription_jobs: raw.pending_transcription_jobs as AiState["pending_transcription_jobs"],
    audio_transcription_retried_message_ids: raw.audio_transcription_retried_message_ids as string[],
    bot_loop_detected_at: raw.bot_loop_detected_at ? String(raw.bot_loop_detected_at) : undefined,
    handoff_reason: raw.handoff_reason ? String(raw.handoff_reason) : undefined,
    bot_loop_window_since: raw.bot_loop_window_since
      ? String(raw.bot_loop_window_since)
      : undefined,
  };

  if (raw.conversation_flow && typeof raw.conversation_flow === "object") {
    const cf = raw.conversation_flow as ConversationFlowState;
    base.conversation_flow = {
      active_workflow_id: String(cf.active_workflow_id ?? "consulta"),
      mode: cf.mode ?? "assisted",
      satisfied: Array.isArray(cf.satisfied) ? cf.satisfied.map(String) : [],
      pending: Array.isArray(cf.pending) ? cf.pending.map(String) : [],
      collected:
        cf.collected && typeof cf.collected === "object"
          ? (cf.collected as Record<string, unknown>)
          : {},
      focus_goal_id: cf.focus_goal_id ? String(cf.focus_goal_id) : undefined,
      pending_confirmation: cf.pending_confirmation,
      current_operation: (() => {
        const status = cf.current_operation?.status;
        if (status === "completed" || status === "active" || status === "abandoned") {
          return {
            status,
            ...(cf.current_operation?.endReason
              ? { endReason: cf.current_operation.endReason }
              : {}),
          };
        }
        return { status: "active" as const };
      })(),
      mutation_done:
        cf.mutation_done && typeof cf.mutation_done === "object"
          ? (cf.mutation_done as Record<string, boolean>)
          : {},
    };
  }

  if (raw.booking && typeof raw.booking === "object") {
    const b = raw.booking as BookingState;
    base.booking = {
      procedure_id: b.procedure_id,
      doctor_id: b.doctor_id,
      date: b.date,
      offered_slots: b.offered_slots,
      pending_slot: b.pending_slot,
      selection_context: b.selection_context,
      selection_epoch: b.selection_epoch,
      status: b.status ?? "collecting",
    };
    return base;
  }

  const procedureId = raw.procedure_id ? String(raw.procedure_id) : undefined;
  const doctorId = raw.doctor_id ? String(raw.doctor_id) : undefined;
  const offeredSlots = raw.offered_slots as OfferedSlot[] | undefined;
  const bookingStep = raw.booking_step ? String(raw.booking_step) : undefined;
  const lastCreated = raw.last_created_appointment_id;

  if (
    procedureId ||
    doctorId ||
    offeredSlots?.length ||
    raw.pending_slot ||
    bookingStep
  ) {
    const status: BookingState["status"] =
      bookingStep === "done" || lastCreated ? "done" : offeredSlots?.length ? "confirming" : "collecting";

    base.booking = {
      procedure_id: procedureId,
      doctor_id: doctorId,
      date: raw.last_slot_query && typeof raw.last_slot_query === "object"
        ? String((raw.last_slot_query as { date?: string }).date ?? "")
        : undefined,
      offered_slots: offeredSlots,
      pending_slot: raw.pending_slot ? String(raw.pending_slot) : undefined,
      status,
    };
    if (base.booking.date === "") delete base.booking.date;
  }

  return base;
}

export function serializeAiState(state: AiState): Record<string, unknown> {
  return { ...state };
}
