import type { NormalizedFacts } from "../extractors/types";
import type { AiState } from "../state/types";
import { isActiveBooking } from "../state/types";
import type { ToolResult } from "../tools/types";
import { needsInputResult, unavailableResult } from "../tools/types";
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
  settings: Partial<VirtualAssistantSettings>,
  facts?: NormalizedFacts
): ToolResult | null {
  if (toolName === "create_appointment") {
    const patientId = args.patient_id ?? aiState.patient_id;
    if (!patientId) {
      return needsInputResult(
        ["patient_id"],
        "Paciente não identificado. Chame lookup_patient_by_phone ou register_patient antes."
      );
    }
    const procedureId = args.procedure_id ?? aiState.booking?.procedure_id;
    if (!procedureId) {
      return needsInputResult(
        ["procedure_id"],
        "Procedimento não definido. Chame list_procedures antes."
      );
    }
    const doctorId = args.doctor_id ?? aiState.booking?.doctor_id;
    if (!doctorId) {
      return needsInputResult(
        ["doctor_id"],
        "Médico não definido. Chame list_doctors antes."
      );
    }
    const scheduledAt = resolveScheduledAt(args, aiState);
    if (!scheduledAt) {
      return needsInputResult(
        ["scheduled_at"],
        "Horário não selecionado. Chame find_available_slots e aguarde o paciente escolher."
      );
    }
    if (!slotIsInOffered(aiState, scheduledAt)) {
      return needsInputResult(
        ["scheduled_at"],
        "Horário fora das opções oferecidas. Use um horário de offered_slots ou busque novamente."
      );
    }
  }

  if (toolName === "find_available_slots") {
    const doctorId = args.doctor_id ?? aiState.booking?.doctor_id;
    if (!doctorId) {
      return needsInputResult(["doctor_id"], "Informe o médico. Chame list_doctors primeiro.");
    }
    const procedureId = args.procedure_id ?? aiState.booking?.procedure_id;
    if (!procedureId) {
      return needsInputResult(["procedure_id"], "Informe o procedimento. Chame list_procedures primeiro.");
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
      return needsInputResult(
        ["appointment_id"],
        "Consulta não identificada. Chame list_patient_appointments antes."
      );
    }
  }

  if (toolName === "register_patient") {
    if (!String(args.full_name ?? "").trim()) {
      return needsInputResult(["full_name"], "Pergunte o nome completo do paciente.");
    }
  }

  if (toolName === "get_service_price") {
    const doctorId = args.doctor_id ?? aiState.booking?.doctor_id;
    if (!doctorId) {
      return needsInputResult(["doctor_id"], "Informe o médico para consultar o preço.");
    }
    const procedureId = args.procedure_id ?? aiState.booking?.procedure_id;
    if (!procedureId && !args.service_id) {
      return needsInputResult(["procedure_id"], "Informe o procedimento para consultar o preço.");
    }
  }

  if (toolName === "transfer_to_human") {
    const reason = String(args.reason ?? "").toLowerCase();
    const explicitHumanRequest =
      reason.includes("human_request") ||
      reason.includes("user_handoff") ||
      reason.includes("complaint") ||
      reason.includes("pedido explícito") ||
      reason.includes("consecutive_tool_failures");

    if (facts?.ordinal != null && !explicitHumanRequest) {
      return needsInputResult(
        ["continue_booking"],
        "Paciente quer escolher opção (ex: qualquer um). Continue o agendamento — não transfira para humano."
      );
    }

    if (isActiveBooking(aiState) && !explicitHumanRequest) {
      return needsInputResult(
        ["explicit_human_request"],
        "Transferência bloqueada durante agendamento. Continue ajudando até o paciente pedir explicitamente um atendente."
      );
    }

    if (!isInsideHandoffWindow(settings)) {
      return unavailableResult(handoffOutsideHoursMessage(settings));
    }
  }

  return null;
}
