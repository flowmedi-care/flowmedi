import { applyReplyGuards } from "../../reply-guards";
import { executeAssistantTool } from "../../tools";
import type { GraphState } from "../state";

export async function financeiroSubgraph(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  const toolResult = await executeAssistantTool(
    {
      supabase: ctx.supabase,
      clinicId: ctx.clinicId,
      conversationId: ctx.conversationId,
      phoneNumber: ctx.phoneNumber,
      aiState: state.aiState,
      pipelineStage: "financeiro",
    },
    "get_payment_status",
    { patient_id: state.aiState.patient_id }
  );

  let parsed: { message?: string; status?: string } = {};
  try {
    parsed = JSON.parse(toolResult.result);
  } catch {
    parsed = {};
  }

  const reply =
    parsed.message ??
    (parsed.status
      ? `Status do pagamento: ${parsed.status}`
      : "Consultei o financeiro — em breve te passo os detalhes.");

  return {
    reply: applyReplyGuards(reply, state.aiState),
    stageSubgraphComplete: true,
  };
}
