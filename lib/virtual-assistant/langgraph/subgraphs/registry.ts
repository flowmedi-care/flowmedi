import type { AgentPipelineStage } from "../../agent-pipeline/stages";
import type { GraphState } from "../state";
import { buildAgendamentoGraph } from "./agendamento/graph";
import { buildCaptacaoGraph } from "./captacao/graph";
import { buildConfirmacaoGraph } from "./confirmacao/graph";
import { buildFinanceiroGraph } from "./financeiro/graph";
import { buildFormulariosGraph } from "./formularios/graph";
import { buildIdentificacaoGraph } from "./identificacao/graph";
import { buildOrcamentoGraph } from "./orcamento/graph";
import { buildPosConsultaGraph } from "./pos-consulta/graph";
import { buildSatisfacaoGraph } from "./satisfacao/graph";

type CompiledStageGraph = {
  invoke: (state: GraphState) => Promise<GraphState>;
};

const BUILDERS: Record<AgentPipelineStage, () => CompiledStageGraph> = {
  identificacao: buildIdentificacaoGraph,
  captacao: buildCaptacaoGraph,
  orcamento: buildOrcamentoGraph,
  agendamento: buildAgendamentoGraph,
  confirmacao_pre_consulta: buildConfirmacaoGraph,
  pos_consulta: buildPosConsultaGraph,
  financeiro: buildFinanceiroGraph,
  formularios: buildFormulariosGraph,
  satisfacao: buildSatisfacaoGraph,
};

export async function invokeStageSubgraph(
  stage: AgentPipelineStage,
  state: GraphState
): Promise<Partial<GraphState>> {
  const builder = BUILDERS[stage] ?? BUILDERS.captacao;
  const graph = builder();
  const result = await graph.invoke(state);
  return result as Partial<GraphState>;
}

export function resetAllStageGraphsForTests(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const graphs = [
    "./agendamento/graph",
    "./captacao/graph",
    "./confirmacao/graph",
    "./financeiro/graph",
    "./formularios/graph",
    "./identificacao/graph",
    "./orcamento/graph",
    "./pos-consulta/graph",
    "./satisfacao/graph",
  ] as const;
  for (const mod of graphs) {
    const m = require(mod) as { resetAgendamentoGraphForTests?: () => void; resetCaptacaoGraphForTests?: () => void; resetConfirmacaoGraphForTests?: () => void; resetFinanceiroGraphForTests?: () => void; resetFormulariosGraphForTests?: () => void; resetIdentificacaoGraphForTests?: () => void; resetOrcamentoGraphForTests?: () => void; resetPosConsultaGraphForTests?: () => void; resetSatisfacaoGraphForTests?: () => void };
    Object.values(m).forEach((fn) => {
      if (typeof fn === "function") fn();
    });
  }
}
