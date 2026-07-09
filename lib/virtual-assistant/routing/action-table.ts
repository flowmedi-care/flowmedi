import { filterFreshOfferedSlots } from "@/lib/booking-state";
import type { InboundIntent } from "../detect-inbound-intent";
import { isDormantBookingState } from "../booking-continuity-guards";
import type { AgentPipelineStage } from "../agent-pipeline/stages";
import type { AiConversationState, BookingStep } from "../types";
import { CAPTACAO_GREETING_MENU } from "../langgraph/trace";

export type GlobalAction =
  | { type: "booking_handler" }
  | { type: "invoke_subgraph"; stage: AgentPipelineStage }
  | { type: "deterministic_reply"; reply: string; stage?: AgentPipelineStage }
  | { type: "bounded_tool_loop" }
  | { type: "pass_through" };

export function resolveGlobalAction(input: {
  derivedStage: AgentPipelineStage;
  bookingStep?: BookingStep;
  detectedIntent: InboundIntent;
  aiState: AiConversationState;
  hasReply?: boolean;
}): GlobalAction {
  const { derivedStage, detectedIntent, aiState, hasReply } = input;

  if (hasReply) return { type: "pass_through" };

  if (detectedIntent === "greeting" && derivedStage !== "agendamento") {
    return {
      type: "deterministic_reply",
      reply: CAPTACAO_GREETING_MENU,
      stage: "captacao",
    };
  }

  const offeredSlots = filterFreshOfferedSlots(aiState.offered_slots ?? []);
  const dormant = isDormantBookingState(aiState);

  if (
    dormant &&
    (detectedIntent === "general" ||
      detectedIntent === "greeting" ||
      detectedIntent === "unknown" ||
      detectedIntent === "pricing" ||
      detectedIntent === "hours_location")
  ) {
    return { type: "invoke_subgraph", stage: "captacao" };
  }

  if (derivedStage === "agendamento" || offeredSlots.length > 0) {
    return { type: "booking_handler" };
  }

  if (
    derivedStage === "orcamento" ||
    derivedStage === "confirmacao_pre_consulta" ||
    derivedStage === "financeiro" ||
    derivedStage === "formularios" ||
    derivedStage === "identificacao" ||
    derivedStage === "captacao" ||
    derivedStage === "pos_consulta" ||
    derivedStage === "satisfacao"
  ) {
    return { type: "invoke_subgraph", stage: derivedStage };
  }

  return { type: "bounded_tool_loop" };
}
