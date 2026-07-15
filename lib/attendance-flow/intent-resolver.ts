import type { AiState } from "@/lib/chatbot/state/types";
import { isActiveBooking } from "@/lib/chatbot/state/types";
import type { IntentResolution } from "./types";

const CANCEL_PATTERNS = /\b(cancelar|cancela|desmarcar|desmarca)\b/i;
const RESCHEDULE_PATTERNS = /\b(remarcar|remarca|mudar hor[aá]rio|trocar hor[aá]rio)\b/i;
const CHECK_IN_PATTERNS =
  /\b(check[\s-]?in|cheguei|j[aá]\s+cheguei|fazer\s+check[\s-]?in|realizar\s+check[\s-]?in)\b/i;
const QUOTE_PATTERNS = /\b(pre[cç]o|valor|quanto custa|or[cç]amento)\b/i;
const BOOKING_PATTERNS = /\b(agendar|agenda|marcar consulta|marca[r]?|consulta|hor[aá]rio dispon[ií]vel)\b/i;

const MUTATION_WORKFLOWS = new Set(["reschedule", "cancelamento", "check_in"]);

/**
 * Current Operation still has a mutation goal pending (cancel/reschedule/check-in).
 * While true, isActiveBooking must not steal the turn into consulta.
 */
export function hasPendingMutationOperation(aiState: AiState): boolean {
  const flow = aiState.conversation_flow;
  if (!flow || !MUTATION_WORKFLOWS.has(flow.active_workflow_id)) return false;
  if (flow.pending.includes("reschedule_booking")) return true;
  if (flow.pending.includes("cancel_booking")) return true;
  if (flow.pending.includes("check_in")) return true;
  return false;
}

export type IntentResolverInput = {
  userText: string;
  aiState: AiState;
};

export function resolveIntent(input: IntentResolverInput): IntentResolution {
  const text = input.userText.trim();
  const activeWorkflow = input.aiState.conversation_flow?.active_workflow_id;
  const mutationOp = hasPendingMutationOperation(input.aiState);

  if (CANCEL_PATTERNS.test(text)) {
    return {
      workflow_id: "cancelamento",
      confidence: "high",
      reason: "keyword_cancel",
    };
  }

  if (RESCHEDULE_PATTERNS.test(text)) {
    return {
      workflow_id: "reschedule",
      confidence: "medium",
      reason: "keyword_reschedule",
    };
  }

  if (CHECK_IN_PATTERNS.test(text)) {
    return {
      workflow_id: "check_in",
      confidence: "high",
      reason: "keyword_check_in",
    };
  }

  if (QUOTE_PATTERNS.test(text) && !isActiveBooking(input.aiState)) {
    return {
      workflow_id: "quotation",
      confidence: "medium",
      reason: "keyword_quotation",
    };
  }

  // Booking collecting during remarcação/cancel is NOT a new consulta.
  if (!mutationOp && (BOOKING_PATTERNS.test(text) || isActiveBooking(input.aiState))) {
    return {
      workflow_id: "consulta",
      confidence: isActiveBooking(input.aiState) ? "high" : "medium",
      reason: isActiveBooking(input.aiState) ? "active_booking" : "keyword_booking",
    };
  }

  if (activeWorkflow && activeWorkflow !== "consulta") {
    return {
      workflow_id: activeWorkflow,
      confidence: "low",
      reason: "keep_active_workflow",
    };
  }

  return {
    workflow_id: "consulta",
    confidence: "low",
    reason: "default_consulta",
  };
}

export function shouldSwitchWorkflow(
  currentWorkflowId: string | undefined,
  resolved: IntentResolution
): boolean {
  if (!currentWorkflowId) return true;
  if (currentWorkflowId === resolved.workflow_id) return false;
  if (resolved.confidence === "high") return true;
  if (resolved.confidence === "medium" && resolved.reason.startsWith("keyword_")) return true;
  return false;
}
