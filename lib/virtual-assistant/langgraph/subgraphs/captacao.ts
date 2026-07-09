import type { GraphState } from "../state";
import { agendamentoSubgraph } from "./agendamento";
import { orcamentoSubgraph } from "./orcamento";
import { runStageToolLoop } from "../tools/tool-node";

export async function captacaoSubgraph(state: GraphState): Promise<Partial<GraphState>> {
  if (state.detectedIntent === "pricing" || state.detectedIntent === "quote") {
    return orcamentoSubgraph({
      ...state,
      pipelineStage: "orcamento",
      aiState: { ...state.aiState, intent: "pricing" },
    });
  }

  if (
    state.detectedIntent === "booking" ||
    state.detectedIntent === "availability_check"
  ) {
    return agendamentoSubgraph({
      ...state,
      pipelineStage: "agendamento",
      aiState: { ...state.aiState, intent: "booking", booking_step: "procedure" },
    });
  }

  if (state.detectedIntent === "greeting") {
    const { applyReplyGuards } = await import("../../reply-guards");
    return {
      reply: applyReplyGuards(
        "Olá! Posso ajudar com:\n1. Agendar consulta\n2. Valores e procedimentos\n3. Falar com a equipe\n\nO que você precisa?",
        state.aiState
      ),
      stageSubgraphComplete: true,
    };
  }

  return runStageToolLoop(state);
}
