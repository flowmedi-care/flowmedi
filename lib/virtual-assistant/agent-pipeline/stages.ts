import type { AssistantToolCategory } from "../tools/catalog";
import type { JourneyStepCode } from "@/lib/contact-journey/types";

export type AgentPipelineStage =
  | "identificacao"
  | "captacao"
  | "orcamento"
  | "agendamento"
  | "confirmacao_pre_consulta"
  | "pos_consulta"
  | "financeiro"
  | "formularios"
  | "satisfacao";

export type AgentPipelineStageKind = "main" | "parallel" | "transversal";

export type AgentPipelineStageDefinition = {
  code: AgentPipelineStage;
  label: string;
  shortLabel: string;
  kind: AgentPipelineStageKind;
  crmPhase: string;
  description: string;
  /** Ferramentas de leitura permitidas nesta etapa. */
  readTools: string[];
  /** Ferramentas mutáveis permitidas nesta etapa (filtro rígido). */
  mutatingTools: string[];
  /** Ordem obrigatória de execução (subconjunto das tools da etapa). */
  requiredOrder?: string[];
  preconditions: string[];
  exitConditions: string[];
  /** Journey steps que aguardam resposta nesta etapa do pipeline (bridge → timeout-policy). */
  timeoutPolicyRef?: JourneyStepCode[];
};

export const AGENT_PIPELINE_STAGES: AgentPipelineStageDefinition[] = [
  {
    code: "identificacao",
    label: "Identificação do contato",
    shortLabel: "Identificação",
    kind: "main",
    crmPhase: "Captação",
    description: "Reconhecer quem está falando e posicionar na jornada.",
    readTools: ["lookup_patient_by_phone", "get_contact_journey"],
    mutatingTools: [],
    preconditions: ["Telefone da conversa disponível"],
    exitConditions: [
      "Paciente não encontrado → Captação",
      "Consulta futura → Confirmação pré-consulta",
      "Orçamento pendente → Orçamento",
      "Consulta realizada → Pós-consulta",
    ],
  },
  {
    code: "captacao",
    label: "Captação / Descoberta",
    shortLabel: "Captação",
    kind: "main",
    crmPhase: "Captação",
    description: "Descobrir interesse, serviços e preços informativos.",
    readTools: [
      "list_services",
      "list_procedures",
      "get_procedure_info",
      "get_service_price",
      "list_price_options",
      "get_contact_journey",
      "lookup_patient_by_phone",
      "infer_dropout_reason",
    ],
    mutatingTools: [],
    timeoutPolicyRef: ["qualificacao", "negociacao", "aguardando_retorno"],
    preconditions: ["Contato identificado (lead ou paciente)"],
    exitConditions: ["Interesse em preço formal → Orçamento", "Quer agendar → Agendamento"],
  },
  {
    code: "orcamento",
    label: "Orçamento / Negociação",
    shortLabel: "Orçamento",
    kind: "main",
    crmPhase: "Comercial",
    description: "Resolver oferta, enviar orçamento e consultar status.",
    readTools: ["resolve_quote_offer", "get_quote_status", "get_contact_journey", "get_service_price", "list_price_options", "infer_dropout_reason"],
    mutatingTools: ["create_and_send_quote"],
    timeoutPolicyRef: ["orcamento_enviado", "orcamento_vencido"],
    requiredOrder: ["resolve_quote_offer", "create_and_send_quote"],
    preconditions: ["Serviço/procedimento definido"],
    exitConditions: ["Orçamento aceito (humano) → Agendamento", "Sem resposta → Captação"],
  },
  {
    code: "agendamento",
    label: "Agendamento",
    shortLabel: "Agendamento",
    kind: "main",
    crmPhase: "Pré-consulta",
    description: "Selecionar procedimento, médico, horário e criar consulta.",
    readTools: [
      "list_procedures",
      "list_doctors",
      "find_available_slots",
      "get_contact_journey",
      "lookup_patient_by_phone",
    ],
    mutatingTools: ["register_patient", "create_appointment"],
    requiredOrder: [
      "list_procedures",
      "list_doctors",
      "find_available_slots",
      "register_patient",
      "create_appointment",
    ],
    preconditions: ["Procedimento definido", "Disponibilidade consultada"],
    exitConditions: ["Agendamento criado → Confirmação pré-consulta"],
  },
  {
    code: "confirmacao_pre_consulta",
    label: "Confirmação pré-consulta",
    shortLabel: "Confirmação",
    kind: "main",
    crmPhase: "Pré-consulta",
    description: "Confirmar, remarcar ou cancelar consultas futuras.",
    readTools: ["list_patient_appointments", "infer_dropout_reason"],
    mutatingTools: ["confirm_appointment", "reschedule_appointment", "cancel_appointment"],
    timeoutPolicyRef: ["compliance_2d_enviado", "sem_resposta_confirmacao", "motivo_nao_confirmacao"],
    preconditions: ["Consulta futura existe"],
    exitConditions: [
      "Confirmado → aguarda dia da consulta",
      "Desistiu → Captação",
      "Remarcar → Agendamento",
      "Realizada → Pós-consulta",
    ],
  },
  {
    code: "pos_consulta",
    label: "Pós-consulta / Retorno",
    shortLabel: "Pós-consulta",
    kind: "main",
    crmPhase: "Pós-consulta",
    description: "Retorno, histórico e encaminhamento para novo ciclo.",
    readTools: ["list_patient_appointments", "get_contact_journey"],
    mutatingTools: ["create_appointment"],
    preconditions: ["Consulta já ocorreu"],
    exitConditions: ["Retorno necessário → Agendamento", "NPS → Satisfação"],
  },
  {
    code: "financeiro",
    label: "Financeiro (somente leitura)",
    shortLabel: "Financeiro",
    kind: "parallel",
    crmPhase: "Financeiro",
    description: "Informar status de pagamento — nunca registrar pagamento.",
    readTools: ["get_payment_status"],
    mutatingTools: [],
    preconditions: ["Orçamento aceito ou consulta realizada"],
    exitConditions: ["Informativo — não toma ação de pagamento"],
  },
  {
    code: "formularios",
    label: "Formulários",
    shortLabel: "Formulários",
    kind: "parallel",
    crmPhase: "Pré-consulta",
    description: "Status e reenvio de formulários pendentes.",
    readTools: ["get_form_status", "infer_dropout_reason"],
    mutatingTools: ["resend_form_link"],
    timeoutPolicyRef: ["formulario_pendente"],
    preconditions: ["Formulário pendente vinculado"],
    exitConditions: ["Preenchido → retoma fluxo principal"],
  },
  {
    code: "satisfacao",
    label: "Satisfação (NPS)",
    shortLabel: "NPS",
    kind: "main",
    crmPhase: "Pós-atendimento",
    description: "Coletar feedback pós-atendimento.",
    readTools: ["get_contact_journey", "infer_dropout_reason"],
    mutatingTools: ["collect_nps_feedback"],
    timeoutPolicyRef: ["pesquisa_nps_enviada"],
    preconditions: ["Consulta realizada", "Pesquisa ativa"],
    exitConditions: ["Encerra ciclo ou reabre agendamento"],
  },
];

export const AGENT_PIPELINE_STAGE_MAP = new Map(
  AGENT_PIPELINE_STAGES.map((s) => [s.code, s])
);

export function getStageDefinition(stage: AgentPipelineStage): AgentPipelineStageDefinition {
  return AGENT_PIPELINE_STAGE_MAP.get(stage)!;
}

/** Mapeamento etapa CRM → etapa do pipeline agente. */
export const JOURNEY_STEP_TO_PIPELINE_STAGE: Partial<
  Record<string, AgentPipelineStage>
> = {
  origem_identificada: "identificacao",
  primeiro_contato: "captacao",
  aguardando_retorno: "captacao",
  qualificacao: "captacao",
  informacoes_enviadas: "captacao",
  negociacao: "orcamento",
  fechamento_agendamento: "agendamento",
  cadastro_pendente: "agendamento",
  cadastrado: "captacao",
  orcamento_rascunho: "orcamento",
  orcamento_enviado: "orcamento",
  orcamento_aceito: "agendamento",
  orcamento_recusado: "captacao",
  orcamento_vencido: "captacao",
  consulta_agendada: "confirmacao_pre_consulta",
  agradecimento_agendamento: "confirmacao_pre_consulta",
  compliance_7d_enviado: "confirmacao_pre_consulta",
  compliance_2d_enviado: "confirmacao_pre_consulta",
  consulta_confirmada: "confirmacao_pre_consulta",
  lembrete_dia_enviado: "confirmacao_pre_consulta",
  reagendamento_confirmado: "confirmacao_pre_consulta",
  consulta_realizada: "pos_consulta",
  retorno_sugerido: "pos_consulta",
  retorno_agendado: "pos_consulta",
  consulta_falta: "pos_consulta",
  consulta_cancelada: "captacao",
  pagamento_pendente: "financeiro",
  pagamento_parcial: "financeiro",
  pago: "financeiro",
  formulario_pendente: "formularios",
  formulario_ok: "confirmacao_pre_consulta",
  pesquisa_nps_enviada: "satisfacao",
  feedback_recebido: "satisfacao",
  reclamacao_escalada: "identificacao",
};

export const STAGE_CATEGORY_COLORS: Record<AssistantToolCategory, string> = {
  paciente: "#3b82f6",
  agendamento: "#8b5cf6",
  precos: "#06b6d4",
  comercial: "#f59e0b",
  crm: "#10b981",
  formulario: "#6366f1",
  financeiro: "#ef4444",
  atendimento: "#dc2626",
};
