import type { MutationOutcome } from "../tools/mutation-result";
import type { ToolResult } from "../tools/types";
import type { AiState } from "../state/types";
import { hasValidPendingSlot } from "../state/selection-context";
import { resolveCreateAppointmentScheduledAt } from "../state/patch";

/** Terminal mutations: until success or error, no further op-changing tools in the turn. */
export const TERMINAL_MUTATION_TOOLS = new Set([
  "create_appointment",
  "reschedule_appointment",
  "cancel_appointment",
]);

/** Tools that change conversational focus / operation after a failed terminal mutation. */
export const OPERATION_CHANGING_TOOLS = new Set([
  "list_patient_appointments",
  "list_doctors",
  "list_procedures",
  "find_available_slots",
  "find_available_days",
  "create_appointment",
  "reschedule_appointment",
  "cancel_appointment",
  "perform_check_in",
  "transfer_to_human",
]);

export function isTerminalMutationTool(toolName: string): boolean {
  return TERMINAL_MUTATION_TOOLS.has(toolName);
}

export function isOperationChangingTool(toolName: string): boolean {
  return OPERATION_CHANGING_TOOLS.has(toolName);
}

export function isTerminalMutationFailure(
  toolName: string,
  mutationOutcome: MutationOutcome,
  result: Pick<ToolResult, "status">
): boolean {
  if (!isTerminalMutationTool(toolName)) return false;
  if (mutationOutcome === "success" && result.status === "success") return false;
  return true;
}

/**
 * Confirmed create: IDs and scheduled_at come only from domain state.
 * LLM placeholders (doc_id, procedure_id) must never win.
 */
export function buildCreateAppointmentArgsFromState(
  aiState: AiState
): Record<string, unknown> | null {
  const patientId = aiState.patient_id?.trim();
  const doctorId = aiState.booking?.doctor_id?.trim();
  const procedureId = aiState.booking?.procedure_id?.trim();
  if (!patientId || !doctorId || !procedureId) return null;
  if (!hasValidPendingSlot(aiState.booking)) return null;

  const scheduledAt = resolveCreateAppointmentScheduledAt({}, aiState);
  if (!scheduledAt) return null;

  return {
    patient_id: patientId,
    doctor_id: doctorId,
    procedure_id: procedureId,
    scheduled_at: scheduledAt,
  };
}

export function terminalMutationErrorMessage(
  toolName: string,
  rawMessage?: string | null
): string {
  const detail = rawMessage?.trim();
  if (toolName === "create_appointment") {
    const base =
      "Não consegui concluir o agendamento. Podemos tentar de novo? Responda Sim para confirmar o mesmo horário.";
    if (detail && !/uuid|invalid input syntax/i.test(detail)) {
      return `${detail} Podemos tentar de novo? Responda Sim para confirmar o mesmo horário.`;
    }
    return base;
  }
  if (toolName === "reschedule_appointment") {
    return (
      detail ??
      "Não consegui remarcar. Podemos tentar de novo? Responda Sim para confirmar o mesmo horário."
    );
  }
  if (toolName === "cancel_appointment") {
    return detail ?? "Não consegui cancelar. Podemos tentar de novo?";
  }
  return detail ?? "Não consegui concluir a operação. Podemos tentar de novo?";
}
