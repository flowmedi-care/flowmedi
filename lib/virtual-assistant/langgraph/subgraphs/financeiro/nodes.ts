import { applyReplyGuards } from "@/lib/virtual-assistant/reply-guards";
import { executeAssistantTool } from "@/lib/virtual-assistant/tools";
import type { GraphState } from "../../state";
import { mergeStageResult } from "../build-stage-graph";

export async function financeiroStatusNode(state: GraphState): Promise<Partial<GraphState>> {
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

  return mergeStageResult(
    {
      aiState: { ...state.aiState, ...toolResult.statePatch },
      reply: applyReplyGuards(reply, state.aiState),
      stageSubgraphComplete: true,
    },
    "financeiro"
  );
}
