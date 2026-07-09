import type { AgentPipelineStage } from "../../agent-pipeline/stages";
import type { GraphState } from "../state";
import { agendamentoSubgraph } from "../subgraphs/agendamento";
import { captacaoSubgraph } from "../subgraphs/captacao";
import { confirmacaoSubgraph } from "../subgraphs/confirmacao";
import { financeiroSubgraph } from "../subgraphs/financeiro";
import { formulariosSubgraph } from "../subgraphs/formularios";
import { identificacaoSubgraph } from "../subgraphs/identificacao";
import { orcamentoSubgraph } from "../subgraphs/orcamento";
import { posConsultaSubgraph } from "../subgraphs/pos-consulta";
import { satisfacaoSubgraph } from "../subgraphs/satisfacao";

const STAGE_RUNNERS: Record<AgentPipelineStage, (state: GraphState) => Promise<Partial<GraphState>>> = {
  identificacao: identificacaoSubgraph,
  captacao: captacaoSubgraph,
  orcamento: orcamentoSubgraph,
  agendamento: agendamentoSubgraph,
  confirmacao_pre_consulta: confirmacaoSubgraph,
  pos_consulta: posConsultaSubgraph,
  financeiro: financeiroSubgraph,
  formularios: formulariosSubgraph,
  satisfacao: satisfacaoSubgraph,
};

export async function stageRouterNode(state: GraphState): Promise<Partial<GraphState>> {
  const stage = state.pipelineStage;
  const runner = STAGE_RUNNERS[stage] ?? captacaoSubgraph;
  const result = await runner(state);

  if (
    state.parallelStages.includes("financeiro") &&
    stage !== "financeiro" &&
    (state.detectedIntent === "payment" || state.aiState.intent === "payment")
  ) {
    const financeResult = await financeiroSubgraph({ ...state, ...result });
    if (financeResult.reply) return financeResult;
  }

  if (
    state.parallelStages.includes("formularios") &&
    stage !== "formularios" &&
    state.detectedIntent === "form"
  ) {
    const formResult = await formulariosSubgraph({ ...state, ...result });
    if (formResult.reply) return formResult;
  }

  return result;
}

export function routeAfterStage(state: GraphState): "compose" | "confirm" | "tool_loop" | "handoff" {
  if (state.handoff) return "handoff";
  if (state.needsHumanConfirm || state.aiState.pending_tool_confirmation) return "confirm";
  if (state.needsToolLoop) return "tool_loop";
  if (state.reply?.trim()) return "compose";
  if (state.stageSubgraphComplete) return "compose";
  return "compose";
}

export function stageRouterEdge(state: GraphState): AgentPipelineStage {
  return state.pipelineStage;
}
