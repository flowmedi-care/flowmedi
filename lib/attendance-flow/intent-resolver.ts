import type { AiState } from "@/lib/chatbot/state/types";
import { isActiveBooking } from "@/lib/chatbot/state/types";
import type { IntentResolution } from "./types";

const CANCEL_PATTERNS = /\b(cancelar|cancela|desmarcar|desmarca)\b/i;
const RESCHEDULE_PATTERNS = /\b(remarcar|remarca|mudar hor[aá]rio|trocar hor[aá]rio)\b/i;
const QUOTE_PATTERNS = /\b(pre[cç]o|valor|quanto custa|or[cç]amento)\b/i;
const BOOKING_PATTERNS = /\b(agendar|agenda|marcar consulta|marca[r]?|consulta|hor[aá]rio dispon[ií]vel)\b/i;

export type IntentResolverInput = {
  userText: string;
  aiState: AiState;
};

export function resolveIntent(input: IntentResolverInput): IntentResolution {
  const text = input.userText.trim();
  const activeWorkflow = input.aiState.conversation_flow?.active_workflow_id;

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

  if (QUOTE_PATTERNS.test(text) && !isActiveBooking(input.aiState)) {
    return {
      workflow_id: "quotation",
      confidence: "medium",
      reason: "keyword_quotation",
    };
  }

  if (BOOKING_PATTERNS.test(text) || isActiveBooking(input.aiState)) {
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
