import type { AiState } from "../state/types";
import { isActiveBooking } from "../state/types";
import type { ToolResult } from "../tools/types";
import { validationError } from "../tools/types";
import { resolveScheduledAt, slotIsInOffered } from "../state/patch";
import {
  handoffOutsideHoursMessage,
  isInsideHandoffWindow,
} from "@/lib/virtual-assistant/handoff-hours";
import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";

const APPOINTMENT_MUTATIONS = new Set([
  "cancel_appointment",
  "reschedule_appointment",
]);

export function validateToolCall(
  toolName: string,
  args: Record<string, unknown>,
  aiState: AiState,
  settings: Partial<VirtualAssistantSettings>
): ToolResult | null {
  if (toolName === "create_appointment") {
    const patientId = args.patient_id ?? aiState.patient_id;
    if (!patientId) {
      return validationError(
        "Paciente não identificado.",
        "Chame lookup_patient_by_phone ou register_patient antes de create_appointment."
      );
    }
    const procedureId = args.procedure_id ?? aiState.booking?.procedure_id;
    if (!procedureId) {
      return validationError(
        "Procedimento não definido.",
        "Chame list_procedures antes de create_appointment."
      );
    }
    const doctorId = args.doctor_id ?? aiState.booking?.doctor_id;
    if (!doctorId) {
      return validationError(
        "Médico não definido.",
        "Chame list_doctors antes de create_appointment."
      );
    }
    const scheduledAt = resolveScheduledAt(args, aiState);
    if (!scheduledAt) {
      return validationError(
        "Horário não selecionado.",
        "Chame find_available_slots e aguarde o paciente escolher um horário."
      );
    }
    if (!slotIsInOffered(aiState, scheduledAt)) {
      return validationError(
        "Horário fora das opções oferecidas.",
        "Use um horário da lista offered_slots ou chame find_available_slots novamente."
      );
    }
  }

  if (toolName === "find_available_slots") {
    const doctorId = args.doctor_id ?? aiState.booking?.doctor_id;
    if (!doctorId) {
      return validationError("doctor_id obrigatório.", "Chame list_doctors primeiro.");
    }
    const procedureId = args.procedure_id ?? aiState.booking?.procedure_id;
    if (!procedureId) {
      return validationError("procedure_id obrigatório.", "Chame list_procedures primeiro.");
    }
  }

  if (APPOINTMENT_MUTATIONS.has(toolName)) {
    const appointmentId =
      args.appointment_id ?? aiState.focused_appointment_id;
    const hasSingle =
      aiState.active_appointments?.length === 1
        ? aiState.active_appointments[0]
        : null;
    if (!appointmentId && !hasSingle) {
      return validationError(
        "Consulta não identificada.",
        "Chame list_patient_appointments antes de cancelar ou remarcar."
      );
    }
  }

  if (toolName === "register_patient") {
    if (!String(args.full_name ?? "").trim()) {
      return validationError("Nome obrigatório.", "Pergunte o nome completo do paciente.");
    }
  }

  if (toolName === "get_service_price") {
    const doctorId = args.doctor_id ?? aiState.booking?.doctor_id;
    if (!doctorId) {
      return validationError("doctor_id obrigatório.", "Informe o médico para consultar o preço.");
    }
    const procedureId = args.procedure_id ?? aiState.booking?.procedure_id;
    if (!procedureId && !args.service_id) {
      return validationError(
        "procedure_id obrigatório.",
        "Informe o procedimento para consultar o preço."
      );
    }
  }

  if (toolName === "transfer_to_human") {
    const reason = String(args.reason ?? "").toLowerCase();
    const explicitHumanRequest =
      reason.includes("human_request") ||
      reason.includes("user_handoff") ||
      reason.includes("complaint") ||
      reason.includes("pedido explícito");

    if (isActiveBooking(aiState) && !explicitHumanRequest) {
      return validationError(
        "Transferência bloqueada durante agendamento.",
        "Continue ajudando com o agendamento. Só transfira se o paciente pedir explicitamente atendente humano."
      );
    }

    if (!isInsideHandoffWindow(settings)) {
      return validationError(handoffOutsideHoursMessage(settings));
    }
  }

  return null;
}
