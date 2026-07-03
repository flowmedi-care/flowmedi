import { AGENT_PIPELINE_FLOW_NODES } from "./flow-graph";
import { CRM_TRANSITIONS } from "./flow-model";
import { AGENT_PIPELINE_STAGES } from "./stages";

export type PipelineConfigStage = {
  id: string;
  nome: string;
  ferramentas_permitidas: string[];
  pre_condicoes: string[];
  transicoes: { para: string; condicao?: string; trigger: string }[];
};

/** JSON estático derivado do código — fonte da verdade para o runtime. */
export function getPipelineConfigJson(): PipelineConfigStage[] {
  return AGENT_PIPELINE_STAGES.map((stage) => ({
    id: stage.code,
    nome: stage.label,
    ferramentas_permitidas: [...stage.readTools, ...stage.mutatingTools],
    pre_condicoes: stage.preconditions,
    transicoes: CRM_TRANSITIONS.filter((t) => t.from === stage.code).map((t) => ({
      para: t.to,
      condicao: t.label,
      trigger: t.trigger.type,
    })),
  }));
}

export function getStageToolsFromFlowGraph(stageCode: string) {
  const node = AGENT_PIPELINE_FLOW_NODES.find((n) => n.id === stageCode);
  return node?.tools ?? [];
}
