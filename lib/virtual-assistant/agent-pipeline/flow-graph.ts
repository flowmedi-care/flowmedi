import type { AgentPipelineStage } from "./stages";
import { AGENT_PIPELINE_STAGES } from "./stages";
import { ASSISTANT_TOOL_CATALOG } from "../tools/catalog";

export type AgentPipelineFlowNode = {
  id: AgentPipelineStage | "escalonamento";
  label: string;
  shortLabel: string;
  kind: "main" | "parallel" | "transversal";
  crmPhase: string;
  col: number;
  row: number;
  tools: { name: string; label: string; category: string; mutating: boolean }[];
};

export type AgentPipelineFlowEdge = {
  from: AgentPipelineFlowNode["id"];
  to: AgentPipelineFlowNode["id"];
  label?: string;
  kind: "main" | "parallel" | "transversal";
  /** Hint para roteamento ortogonal no canvas (derivado automaticamente se omitido) */
  routingHint?: "direct" | "bus-bottom" | "bus-top" | "bus-escalation";
};

const catalogByName = new Map(ASSISTANT_TOOL_CATALOG.map((t) => [t.name, t]));

function toolsForStage(stageCode: AgentPipelineStage, mutatingNames: string[]) {
  const stage = AGENT_PIPELINE_STAGES.find((s) => s.code === stageCode)!;
  const allNames = [...stage.readTools, ...stage.mutatingTools];
  return allNames.map((name) => {
    const entry = catalogByName.get(name);
    return {
      name,
      label: entry?.label ?? name,
      category: entry?.category ?? "crm",
      mutating: mutatingNames.includes(name),
    };
  });
}

export const AGENT_PIPELINE_FLOW_NODES: AgentPipelineFlowNode[] = [
  {
    id: "identificacao",
    label: "Identificação do contato",
    shortLabel: "Identificação",
    kind: "main",
    crmPhase: "Captação",
    col: 0,
    row: 1,
    tools: toolsForStage("identificacao", []),
  },
  {
    id: "captacao",
    label: "Captação / Descoberta",
    shortLabel: "Captação",
    kind: "main",
    crmPhase: "Captação",
    col: 1,
    row: 1,
    tools: toolsForStage("captacao", []),
  },
  {
    id: "orcamento",
    label: "Orçamento / Negociação",
    shortLabel: "Orçamento",
    kind: "main",
    crmPhase: "Comercial",
    col: 2,
    row: 0,
    tools: toolsForStage("orcamento", ["create_and_send_quote"]),
  },
  {
    id: "agendamento",
    label: "Agendamento",
    shortLabel: "Agendamento",
    kind: "main",
    crmPhase: "Pré-consulta",
    col: 2,
    row: 2,
    tools: toolsForStage("agendamento", ["register_patient", "create_appointment"]),
  },
  {
    id: "confirmacao_pre_consulta",
    label: "Confirmação pré-consulta",
    shortLabel: "Confirmação",
    kind: "main",
    crmPhase: "Pré-consulta",
    col: 3,
    row: 1,
    tools: toolsForStage("confirmacao_pre_consulta", [
      "confirm_appointment",
      "reschedule_appointment",
      "cancel_appointment",
    ]),
  },
  {
    id: "pos_consulta",
    label: "Pós-consulta / Retorno",
    shortLabel: "Pós-consulta",
    kind: "main",
    crmPhase: "Pós-consulta",
    col: 4,
    row: 1,
    tools: toolsForStage("pos_consulta", ["create_appointment"]),
  },
  {
    id: "satisfacao",
    label: "Satisfação (NPS)",
    shortLabel: "NPS",
    kind: "main",
    crmPhase: "Pós-atendimento",
    col: 5,
    row: 1,
    tools: toolsForStage("satisfacao", ["collect_nps_feedback"]),
  },
  {
    id: "financeiro",
    label: "Financeiro (somente leitura)",
    shortLabel: "Financeiro",
    kind: "parallel",
    crmPhase: "Financeiro",
    col: 2,
    row: 3,
    tools: toolsForStage("financeiro", []),
  },
  {
    id: "formularios",
    label: "Formulários",
    shortLabel: "Formulários",
    kind: "parallel",
    crmPhase: "Pré-consulta",
    col: 3,
    row: 3,
    tools: toolsForStage("formularios", ["resend_form_link"]),
  },
  {
    id: "escalonamento",
    label: "Transferir para humano",
    shortLabel: "Escalonamento",
    kind: "transversal",
    crmPhase: "Transversal",
    col: 1,
    row: 4,
    tools: [
      {
        name: "transfer_to_human",
        label: "Transferir para humano",
        category: "atendimento",
        mutating: true,
      },
    ],
  },
];

export const AGENT_PIPELINE_FLOW_EDGES: AgentPipelineFlowEdge[] = [
  { from: "identificacao", to: "captacao", label: "Não encontrado", kind: "main" },
  { from: "identificacao", to: "confirmacao_pre_consulta", label: "Consulta futura", kind: "main" },
  { from: "identificacao", to: "orcamento", label: "Orçamento pendente", kind: "main" },
  { from: "identificacao", to: "pos_consulta", label: "Consulta realizada", kind: "main" },
  { from: "captacao", to: "orcamento", label: "Preço formal", kind: "main" },
  { from: "captacao", to: "agendamento", label: "Quer agendar", kind: "main" },
  { from: "orcamento", to: "agendamento", label: "Orçamento aceito", kind: "main" },
  { from: "orcamento", to: "captacao", label: "Sem resposta", kind: "main" },
  { from: "agendamento", to: "confirmacao_pre_consulta", label: "Criado", kind: "main" },
  { from: "confirmacao_pre_consulta", to: "pos_consulta", label: "Realizada", kind: "main" },
  { from: "confirmacao_pre_consulta", to: "agendamento", label: "Remarcar", kind: "main" },
  { from: "confirmacao_pre_consulta", to: "captacao", label: "Desistiu", kind: "main" },
  { from: "pos_consulta", to: "agendamento", label: "Retorno", kind: "main" },
  { from: "pos_consulta", to: "satisfacao", label: "NPS", kind: "main" },
  { from: "identificacao", to: "financeiro", kind: "parallel" },
  { from: "confirmacao_pre_consulta", to: "formularios", kind: "parallel" },
  { from: "agendamento", to: "formularios", kind: "parallel" },
  // Transversal — conecta escalonamento a todos os nós principais
  ...AGENT_PIPELINE_FLOW_NODES.filter((n) => n.kind === "main").map((n) => ({
    from: n.id,
    to: "escalonamento" as const,
    label: "Escalar",
    kind: "transversal" as const,
  })),
];
