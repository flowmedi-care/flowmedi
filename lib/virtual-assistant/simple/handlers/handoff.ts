import { HANDOFF_REPLY_BODY } from "@/lib/whatsapp-sender-display";
import { isInsideHandoffWindow } from "../../handoff-hours";
import { executeAssistantTool } from "../../tools";
import type { GraphState } from "../../langgraph/state";
import type { PartialGraphUpdate } from "./shared";

export async function handleHandoff(state: GraphState): Promise<PartialGraphUpdate> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  if (ctx.settings.human_handoff_enabled === false || !isInsideHandoffWindow(ctx.settings)) {
    return {
      reply:
        "No momento não consigo transferir para a equipe automaticamente. Deixe sua dúvida que retornamos em breve.",
      replySource: "deterministic",
      stageSubgraphComplete: true,
    };
  }

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

  return {
    handoff: true,
    reply: HANDOFF_REPLY_BODY,
    replySource: "deterministic",
    stageSubgraphComplete: true,
  };
}
