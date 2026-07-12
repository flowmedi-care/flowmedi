import type { NormalizedFacts } from "../extractors/types";
import type { AiState } from "../state/types";
import { isActiveBooking } from "../state/types";
import type { ToolResult } from "../tools/types";
import { needsInputResult, unavailableResult } from "../tools/types";
import {
  resolveCreateAppointmentScheduledAt,
  slotIsInOffered,
} from "../state/patch";
import { resolveBookingEntityId } from "../state/resolve-entity-id";
import {
  resolveBookingDate,
  resolveBookingDateFailureMessage,
} from "../state/resolve-booking-date";
import { DEFAULT_CLINIC_TIMEZONE } from "@/lib/clinic-timezone";
import {
  handoffOutsideHoursMessage,
  isInsideHandoffWindow,
} from "@/lib/virtual-assistant/handoff-hours";
import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";
import { canExecuteMutation } from "@/lib/attendance-flow/engine";
import type { EngineInput } from "@/lib/attendance-flow/engine";

const APPOINTMENT_MUTATIONS = new Set([
  "cancel_appointment",
  "reschedule_appointment",
]);

export function validateToolCall(
  toolName: string,
  args: Record<string, unknown>,
  aiState: AiState,
  settings: Partial<VirtualAssistantSettings>,
  facts?: NormalizedFacts,
  engineInput?: EngineInput
): ToolResult | null {
  if (toolName === "create_appointment") {
    const patientId = args.patient_id ?? aiState.patient_id;
    if (!patientId) {
      return needsInputResult(
        ["patient_id"],
        "Paciente não identificado. Chame lookup_patient_by_phone ou register_patient antes."
      );
    }
    const procedureId = resolveBookingEntityId({
      arg: args.procedure_id,
      stateId: aiState.booking?.procedure_id,
      offered: aiState.offered_procedures,
      rejectId: aiState.patient_id,
    });
    if (!procedureId) {
      return needsInputResult(
        ["procedure_id"],
        "Procedimento não definido. Chame list_procedures antes."
      );
    }
    const doctorId = resolveBookingEntityId({
      arg: args.doctor_id,
      stateId: aiState.booking?.doctor_id,
      offered: aiState.offered_doctors,
      rejectId: aiState.patient_id,
    });
    if (!doctorId) {
      return needsInputResult(
        ["doctor_id"],
        "Médico não definido. Chame list_doctors antes."
      );
    }
    const scheduledAt = resolveCreateAppointmentScheduledAt(args, aiState, facts);
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

    if (engineInput) {
      const gate = canExecuteMutation(
        "booking_created",
        engineInput.flowState.mode,
        engineInput.policy,
        engineInput.registry,
        engineInput.flowState.pending,
        engineInput.workflow.id
      );
      if (!gate.ok) {
        return needsInputResult(
          gate.missing.map((m) => ({ field: m })),
          gate.message
        );
      }
    }
  }

  if (toolName === "find_available_slots") {
    const doctorId = resolveBookingEntityId({
      arg: args.doctor_id,
      stateId: aiState.booking?.doctor_id,
      offered: aiState.offered_doctors,
      rejectId: aiState.patient_id,
    });
    if (!doctorId) {
      return needsInputResult(
        ["doctor_id"],
        "Informe o médico com UUID válido. Chame list_doctors primeiro."
      );
    }
    const procedureId = resolveBookingEntityId({
      arg: args.procedure_id,
      stateId: aiState.booking?.procedure_id,
      offered: aiState.offered_procedures,
      rejectId: aiState.patient_id,
    });
    if (!procedureId) {
      return needsInputResult(
        ["procedure_id"],
        "Informe o procedimento. Chame list_procedures primeiro."
      );
    }

    const hasDateArg = args.date != null && String(args.date).trim() !== "";
    if (hasDateArg) {
      const resolvedDate = resolveBookingDate({
        dateArg: args.date,
        offeredDays: aiState.offered_days,
        bookingDate: aiState.booking?.date,
        clinicTimezone: DEFAULT_CLINIC_TIMEZONE,
      });
      if (!resolvedDate.ok) {
        const dayOptions = aiState.offered_days?.length
          ? aiState.offered_days.map((d, i) => ({
              id: d.date,
              label: d.label,
              index: d.index ?? i + 1,
            }))
          : undefined;
        return needsInputResult(
          ["date"],
          resolveBookingDateFailureMessage(resolvedDate.reason),
          dayOptions
        );
      }
      // Mutate args so execute receives the sanitized date if validator runs first.
      args.date = resolvedDate.date;
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

    if (toolName === "cancel_appointment" && engineInput) {
      const gate = canExecuteMutation(
        "cancel_booking",
        engineInput.flowState.mode,
        engineInput.policy,
        engineInput.registry,
        engineInput.flowState.pending,
        engineInput.workflow.id
      );
      if (!gate.ok) {
        return needsInputResult(
          gate.missing.map((m) => ({ field: m })),
          gate.message
        );
      }
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
