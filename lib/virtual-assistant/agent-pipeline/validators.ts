import type { AiConversationState } from "../types";
import { isScheduledAtInOfferedSlots } from "@/lib/booking-state";
import { HUMAN_ONLY_QUOTE_STEPS } from "./constants";
import type { AgentPipelineStage } from "./stages";
import { getStageDefinition } from "./stages";

export type ToolValidationResult =
  | { ok: true }
  | { ok: false; error: string; hint: string; missing?: string[] };

export type CancellationReason = "reschedule" | "dropped" | "other";

export function parseCancellationReason(value: unknown): CancellationReason {
  if (value === "reschedule" || value === "dropped" || value === "other") return value;
  return "other";
}

const APPOINTMENT_MUTATIONS = new Set([
  "confirm_appointment",
  "cancel_appointment",
  "reschedule_appointment",
]);

export function validateToolExecution(
  toolName: string,
  args: Record<string, unknown>,
  aiState: AiConversationState,
  stage: AgentPipelineStage
): ToolValidationResult {
  const stageDef = getStageDefinition(stage);

  if (toolName === "create_appointment") {
    if (!aiState.patient_id && !args.patient_id) {
      return {
        ok: false,
        error: "Paciente não identificado.",
        hint: "Chame lookup_patient_by_phone ou register_patient antes de create_appointment.",
        missing: ["patient_id"],
      };
    }
    if (!aiState.procedure_id && !args.procedure_id) {
      return {
        ok: false,
        error: "Procedimento não definido.",
        hint: "Chame list_procedures e find_available_slots antes de create_appointment.",
        missing: ["procedure_id"],
      };
    }
    if (!aiState.doctor_id && !args.doctor_id) {
      return {
        ok: false,
        error: "Médico não definido.",
        hint: "Chame list_doctors e find_available_slots antes de create_appointment.",
        missing: ["doctor_id"],
      };
    }
    const scheduledAt = String(args.scheduled_at ?? aiState.pending_slot ?? "");
    const hasSlot =
      aiState.pending_slot ||
      args.scheduled_at ||
      (aiState.offered_slots?.length === 1 && aiState.booking_step === "slot");
    if (!hasSlot) {
      return {
        ok: false,
        error: "Horário não selecionado.",
        hint: "Chame find_available_slots com date e aguarde o paciente escolher um horário.",
        missing: ["scheduled_at"],
      };
    }
    if (
      scheduledAt &&
      aiState.offered_slots?.length &&
      !isScheduledAtInOfferedSlots(scheduledAt, aiState.offered_slots)
    ) {
      return {
        ok: false,
        error: "Horário fora das opções oferecidas.",
        hint: "Use um scheduled_at da lista offered_slots ou chame find_available_slots novamente.",
        missing: ["scheduled_at"],
      };
    }
  }

  if (toolName === "find_available_slots") {
    if (!args.doctor_id && !aiState.doctor_id) {
      return {
        ok: false,
        error: "doctor_id obrigatório.",
        hint: "Chame list_doctors primeiro.",
        missing: ["doctor_id"],
      };
    }
    if (!args.procedure_id && !aiState.procedure_id) {
      return {
        ok: false,
        error: "procedure_id obrigatório.",
        hint: "Chame list_procedures primeiro.",
        missing: ["procedure_id"],
      };
    }
  }

  if (toolName === "create_and_send_quote") {
    const journeyStep = aiState.journey_step_code;
    if (journeyStep && HUMAN_ONLY_QUOTE_STEPS.has(journeyStep)) {
      return {
        ok: false,
        error: "Orçamento nesta etapa requer equipe humana.",
        hint: "Informe o paciente que a equipe comercial dará continuidade. Use get_quote_status para consultar.",
      };
    }
    if (!aiState.resolve_quote_offer_done) {
      return {
        ok: false,
        error: "Oferta de orçamento não resolvida.",
        hint: "Chame resolve_quote_offer antes de create_and_send_quote.",
        missing: ["resolve_quote_offer"],
      };
    }
  }

  if (APPOINTMENT_MUTATIONS.has(toolName)) {
    const appointmentId =
      args.appointment_id ??
      aiState.focused_appointment_id ??
      aiState.pending_confirmation_appointment_id;
    if (!appointmentId) {
      const hasSingle =
        aiState.active_appointments?.length === 1
          ? aiState.active_appointments[0]
          : null;
      if (!hasSingle) {
        return {
          ok: false,
          error: "Consulta não identificada.",
          hint: "Chame list_patient_appointments antes de confirmar, cancelar ou remarcar.",
          missing: ["appointment_id"],
        };
      }
    }
  }

  if (toolName === "register_patient") {
    if (!String(args.full_name ?? "").trim()) {
      return {
        ok: false,
        error: "Nome obrigatório.",
        hint: "Pergunte o nome completo do paciente.",
        missing: ["full_name"],
      };
    }
  }

  if (toolName === "collect_nps_feedback") {
    const score = args.score ?? args.nps_score;
    if (score === undefined || score === null) {
      return {
        ok: false,
        error: "Nota NPS obrigatória (0-10).",
        hint: "Pergunte a nota de 0 a 10 antes de registrar.",
        missing: ["score"],
      };
    }
  }

  if (stageDef.mutatingTools.includes(toolName) || toolName === "resolve_quote_offer") {
    return { ok: true };
  }

  return { ok: true };
}

export function patchStateFromToolResult(
  toolName: string,
  args: Record<string, unknown>,
  result: Record<string, unknown>,
  current: AiConversationState
): Partial<AiConversationState> {
  const patch: Partial<AiConversationState> = {};

  if (toolName === "resolve_quote_offer" && !result.error) {
    patch.resolve_quote_offer_done = true;
  }

  if (toolName === "create_and_send_quote" && !result.error) {
    patch.resolve_quote_offer_done = false;
  }

  if (toolName === "list_patient_appointments" && Array.isArray(result.appointments)) {
    const ids = (result.appointments as { id?: string }[])
      .map((a) => a.id)
      .filter(Boolean) as string[];
    if (ids.length === 1) {
      patch.focused_appointment_id = ids[0];
    }
    patch.active_appointments = ids;
  }

  if (toolName === "create_appointment" && result.appointmentId) {
    patch.pipeline_stage = "confirmacao_pre_consulta";
    patch.consecutive_tool_failures = 0;
  }

  if (toolName === "cancel_appointment" && !result.error) {
    const reason = parseCancellationReason(args.cancellation_reason);
    const appointmentId = String(args.appointment_id ?? "");
    if (reason === "reschedule" || result.reschedule_flow) {
      patch.pipeline_stage = "agendamento";
      patch.intent = "reschedule";
      patch.pending_reschedule_appointment_id = appointmentId || current.pending_reschedule_appointment_id;
      patch.pending_confirmation_appointment_id = undefined;
    } else {
      patch.pipeline_stage = "captacao";
      patch.focused_appointment_id = undefined;
      patch.pending_confirmation_appointment_id = undefined;
    }
  }

  return patch;
}
