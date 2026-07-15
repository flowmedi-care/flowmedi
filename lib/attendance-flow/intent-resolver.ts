import type { AiState } from "@/lib/chatbot/state/types";
import { isActiveBooking } from "@/lib/chatbot/state/types";
import type { IntentResolution } from "./types";

const CANCEL_PATTERNS = /\b(cancelar|cancela|desmarcar|desmarca)\b/i;
const RESCHEDULE_PATTERNS =
  /\b(remarcar|remarca|mudar hor[aá]rio|trocar hor[aá]rio|quero\s+mudar\s+hor[aá]rio)\b/i;
const CHECK_IN_PATTERNS =
  /\b(check[\s-]?in|cheguei|j[aá]\s+cheguei|fazer\s+check[\s-]?in|realizar\s+check[\s-]?in)\b/i;
const QUOTE_PATTERNS = /\b(pre[cç]o|valor|quanto custa|or[cç]amento)\b/i;
/** Soft booking — does not break sticky mutation alone. */
const BOOKING_PATTERNS =
  /\b(agendar|agenda|marcar consulta|marca[r]?|consulta|hor[aá]rio dispon[ií]vel)\b/i;
/** Explicit booking intent — independent of context (HIGH interruption). */
const BOOKING_INTERRUPT_PATTERNS =
  /\b(quero\s+agendar|agendar\s+(uma\s+)?consulta|marcar\s+(uma\s+)?consulta|nova\s+consulta|quero\s+marcar)\b/i;
const DISMISS_PATTERNS =
  /\b(esquece\s+(isso|tudo)|deixa\s+pra\s+l[aá]|n[aã]o\s+quero\s+mais(\s+fazer)?(\s+check[\s-]?in)?|cancelar\s+isso)\b/i;

const MUTATION_WORKFLOWS = new Set(["reschedule", "cancelamento", "check_in"]);

export type InterruptionPriority = "HIGH" | "MEDIUM";

/**
 * Explicit conversation transition — only intents with meaning independent of
 * sticky context. Confirmations (sim/ok) are NOT interruptions.
 */
export type ConversationTransition =
  | { interrupted: false }
  | {
      interrupted: true;
      nextWorkflow?: string;
      reason: string;
      priority: InterruptionPriority;
    };

/**
 * Current Operation still has a mutation goal pending (cancel/reschedule/check-in).
 * While true, isActiveBooking must not steal the turn into consulta.
 */
export function hasPendingMutationOperation(aiState: AiState): boolean {
  const flow = aiState.conversation_flow;
  if (!flow || !MUTATION_WORKFLOWS.has(flow.active_workflow_id)) return false;
  const status = flow.current_operation?.status;
  if (status === "completed" || status === "abandoned") return false;
  if (flow.pending.includes("reschedule_booking")) return true;
  if (flow.pending.includes("cancel_booking")) return true;
  if (flow.pending.includes("check_in")) return true;
  return false;
}

export type IntentResolverInput = {
  userText: string;
  aiState: AiState;
};

/**
 * Independent intents that may abandon / switch the Current Operation.
 * Runs before sticky keep_active_workflow.
 */
export function resolveConversationInterruption(
  userText: string
): ConversationTransition {
  const text = userText.trim();

  if (DISMISS_PATTERNS.test(text)) {
    return {
      interrupted: true,
      reason: "user_dismiss",
      priority: "HIGH",
    };
  }

  if (CANCEL_PATTERNS.test(text)) {
    return {
      interrupted: true,
      nextWorkflow: "cancelamento",
      reason: "explicit_cancel",
      priority: "HIGH",
    };
  }

  if (BOOKING_INTERRUPT_PATTERNS.test(text)) {
    return {
      interrupted: true,
      nextWorkflow: "consulta",
      reason: "explicit_booking",
      priority: "HIGH",
    };
  }

  if (CHECK_IN_PATTERNS.test(text)) {
    return {
      interrupted: true,
      nextWorkflow: "check_in",
      reason: "explicit_check_in",
      priority: "HIGH",
    };
  }

  if (RESCHEDULE_PATTERNS.test(text)) {
    return {
      interrupted: true,
      nextWorkflow: "reschedule",
      reason: "explicit_reschedule",
      priority: "MEDIUM",
    };
  }

  return { interrupted: false };
}

export function resolveIntent(input: IntentResolverInput): IntentResolution {
  const text = input.userText.trim();
  const activeWorkflow = input.aiState.conversation_flow?.active_workflow_id;
  const mutationOp = hasPendingMutationOperation(input.aiState);

  const transition = resolveConversationInterruption(text);
  if (transition.interrupted) {
    if (transition.nextWorkflow) {
      return {
        workflow_id: transition.nextWorkflow,
        confidence: transition.priority === "HIGH" ? "high" : "medium",
        reason: transition.reason,
      };
    }
    // Dismiss without next workflow — stay on current id; flow-sync abandons.
    return {
      workflow_id: activeWorkflow ?? "consulta",
      confidence: "high",
      reason: transition.reason,
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
  if (resolved.confidence === "medium" && resolved.reason.startsWith("explicit_")) return true;
  return false;
}
