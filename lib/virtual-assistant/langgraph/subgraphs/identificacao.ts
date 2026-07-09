import { executeAssistantTool } from "../../tools";
import { applyReplyGuards } from "../../reply-guards";
import type { GraphState } from "../state";
import { runStageToolLoop } from "../tools/tool-node";

export async function identificacaoSubgraph(state: GraphState): Promise<Partial<GraphState>> {
  const ctx = state.runtimeContext;
  if (!ctx) return {};

  if (!state.aiState.patient_id) {
    const toolResult = await executeAssistantTool(
      {
        supabase: ctx.supabase,
        clinicId: ctx.clinicId,
        conversationId: ctx.conversationId,
        phoneNumber: ctx.phoneNumber,
        aiState: state.aiState,
        pipelineStage: "identificacao",
      },
      "lookup_patient_by_phone",
      {}
    );

    let parsed: { id?: string; full_name?: string } = {};
    try {
      parsed = JSON.parse(toolResult.result);
    } catch {
      parsed = {};
    }

    if (parsed.id) {
      return {
        aiState: {
          ...state.aiState,
          ...toolResult.statePatch,
          patient_id: parsed.id,
        },
        reply: applyReplyGuards(
          parsed.full_name
            ? `Olá! Vi que você já está cadastrado(a) como ${parsed.full_name}. Como posso ajudar?`
            : "Olá! Identifiquei seu cadastro. Como posso ajudar?",
          state.aiState
        ),
        stageSubgraphComplete: true,
        pipelineStage: "captacao",
      };
    }

    return {
      reply: applyReplyGuards(
        "Olá! Ainda não encontrei seu cadastro. Você quer agendar uma consulta ou saber sobre nossos serviços?",
        state.aiState
      ),
      stageSubgraphComplete: true,
      pipelineStage: "captacao",
    };
  }

  return runStageToolLoop(state);
}
