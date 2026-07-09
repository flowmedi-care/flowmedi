import { isActiveBookingState } from "@/lib/operational-agents/booking-executor";
import { shouldEscalateToHuman } from "../../escalation";
import { isInsideHandoffWindow } from "../../handoff-hours";
import { executeAssistantTool } from "../../tools";
import { HANDOFF_REPLY_BODY } from "@/lib/whatsapp-sender-display";
import type { GraphState } from "../state";

export async function escalateGateNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  if (state.detectedIntent === "human_handoff") {
    if (ctx.settings.human_handoff_enabled !== false && isInsideHandoffWindow(ctx.settings)) {
      await executeAssistantTool(
        {
          supabase: ctx.supabase,
          clinicId: ctx.clinicId,
          conversationId: ctx.conversationId,
          phoneNumber: ctx.phoneNumber,
          aiState: state.aiState,
        },
        "transfer_to_human",
        { reason: "human_request" }
      );
      return { handoff: true, reply: HANDOFF_REPLY_BODY };
    }
  }

  const escalation = shouldEscalateToHuman({
    messageText: state.inboundText,
    lossConfidence: state.aiState.confianca ?? null,
    followupCount: state.aiState.followup_count,
    confirmationStep: Boolean(state.aiState.pending_confirmation_appointment_id),
    activeBooking: isActiveBookingState(state.aiState),
  });

  const inActiveBooking = isActiveBookingState(state.aiState);
  if (
    escalation.escalate &&
    ctx.settings.human_handoff_enabled !== false &&
    !inActiveBooking &&
    isInsideHandoffWindow(ctx.settings)
  ) {
    await executeAssistantTool(
      {
        supabase: ctx.supabase,
        clinicId: ctx.clinicId,
        conversationId: ctx.conversationId,
        phoneNumber: ctx.phoneNumber,
        aiState: state.aiState,
      },
      "transfer_to_human",
      { reason: escalation.trigger ?? "auto_keyword" }
    );
    return { handoff: true, reply: HANDOFF_REPLY_BODY };
  }

  return { handoff: false };
}

export function shouldEscalateAfterGate(state: GraphState): "handoff" | "continue" {
  return state.handoff ? "handoff" : "continue";
}
