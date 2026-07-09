import { HANDOFF_REPLY_BODY } from "@/lib/whatsapp-sender-display";
import { executeAssistantTool } from "../../tools";
import type { GraphState } from "../state";

export async function handoffNode(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) {
    return { reply: HANDOFF_REPLY_BODY, handoff: true };
  }

  if (!state.handoff) {
    await executeAssistantTool(
      {
        supabase: ctx.supabase,
        clinicId: ctx.clinicId,
        conversationId: ctx.conversationId,
        phoneNumber: ctx.phoneNumber,
        aiState: state.aiState,
        skipPipelineValidation: true,
      },
      "transfer_to_human",
      { reason: "langgraph_handoff" }
    );
  }

  return {
    handoff: true,
    reply: state.reply ?? HANDOFF_REPLY_BODY,
    stageSubgraphComplete: true,
  };
}
