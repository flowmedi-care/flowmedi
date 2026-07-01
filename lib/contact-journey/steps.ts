import type { JourneyPhase, JourneyStepCode } from "./types";

export type JourneyStepDefinition = {
  code: JourneyStepCode;
  label: string;
  shortLabel: string;
  phase: JourneyPhase;
  order: number;
};

export const JOURNEY_PHASE_LABELS: Record<JourneyPhase, string> = {
  captacao: "Captação",
  comercial: "Comercial",
  pre_consulta: "Pré-consulta",
  consulta: "Consulta",
  financeiro: "Financeiro",
  pos_consulta: "Pós-consulta",
  pos_atendimento: "Pós-atendimento",
  reengajamento: "Reengajamento",
};

export const JOURNEY_PHASE_ORDER: JourneyPhase[] = [
  "captacao",
  "comercial",
  "pre_consulta",
  "consulta",
  "financeiro",
  "pos_consulta",
  "pos_atendimento",
  "reengajamento",
];

export const JOURNEY_STEPS: JourneyStepDefinition[] = [
  { code: "origem_identificada", label: "Origem identificada", shortLabel: "Origem", phase: "captacao", order: 1 },
  { code: "primeiro_contato", label: "Primeiro contato", shortLabel: "Contato", phase: "captacao", order: 2 },
  { code: "qualificacao", label: "Qualificação", shortLabel: "Qualificação", phase: "captacao", order: 3 },
  { code: "informacoes_enviadas", label: "Informações enviadas", shortLabel: "Informações", phase: "captacao", order: 4 },
  { code: "negociacao", label: "Negociação", shortLabel: "Negociação", phase: "captacao", order: 5 },
  { code: "fechamento_agendamento", label: "Fechamento / agendamento", shortLabel: "Fechamento", phase: "captacao", order: 6 },
  { code: "aguardando_retorno", label: "Aguardando retorno", shortLabel: "Retorno", phase: "captacao", order: 7 },
  { code: "cadastro_pendente", label: "Cadastro pendente", shortLabel: "Cadastro", phase: "captacao", order: 8 },
  { code: "cadastrado", label: "Cadastrado", shortLabel: "Cadastrado", phase: "captacao", order: 9 },
  { code: "objecao_identificada", label: "Objeção identificada", shortLabel: "Objeção", phase: "captacao", order: 10 },
  { code: "reativacao_iniciada", label: "Reativação iniciada", shortLabel: "Reativação", phase: "reengajamento", order: 11 },
  { code: "reativacao_concluida", label: "Reativação concluída", shortLabel: "Reativado", phase: "reengajamento", order: 12 },
  { code: "repescagem_ativa", label: "Repescagem ativa", shortLabel: "Repescagem", phase: "reengajamento", order: 13 },
  { code: "suporte_iniciado", label: "Suporte iniciado", shortLabel: "Suporte", phase: "captacao", order: 14 },
  { code: "suporte_concluido", label: "Suporte concluído", shortLabel: "Suporte ok", phase: "captacao", order: 15 },
  { code: "reclamacao_escalada", label: "Reclamação escalada", shortLabel: "Reclamação", phase: "captacao", order: 16 },
  { code: "orcamento_rascunho", label: "Orçamento em rascunho", shortLabel: "Orç. rascunho", phase: "comercial", order: 20 },
  { code: "orcamento_enviado", label: "Orçamento enviado", shortLabel: "Orç. enviado", phase: "comercial", order: 21 },
  { code: "orcamento_aceito", label: "Orçamento aceito", shortLabel: "Orç. aceito", phase: "comercial", order: 22 },
  { code: "orcamento_recusado", label: "Orçamento recusado", shortLabel: "Orç. recusado", phase: "comercial", order: 23 },
  { code: "orcamento_vencido", label: "Orçamento vencido", shortLabel: "Vencido", phase: "comercial", order: 24 },
  { code: "pagamento_sinal_pendente", label: "Pagamento sinal pendente", shortLabel: "Sinal", phase: "comercial", order: 25 },
  { code: "comprovante_recebido", label: "Comprovante recebido", shortLabel: "Comprovante", phase: "comercial", order: 26 },
  { code: "autorizacao_pendente", label: "Autorização pendente", shortLabel: "Autorização", phase: "comercial", order: 27 },
  { code: "autorizacao_convenio_pendente", label: "Convênio pendente", shortLabel: "Convênio", phase: "comercial", order: 28 },
  { code: "consulta_agendada", label: "Consulta agendada", shortLabel: "Agendada", phase: "pre_consulta", order: 30 },
  { code: "agradecimento_agendamento", label: "Agradecimento agendamento", shortLabel: "Agradec.", phase: "pre_consulta", order: 31 },
  { code: "compliance_7d_enviado", label: "Lembrete 7 dias", shortLabel: "7 dias", phase: "pre_consulta", order: 32 },
  { code: "compliance_2d_enviado", label: "Confirmação 2 dias", shortLabel: "2 dias", phase: "pre_consulta", order: 33 },
  { code: "sem_resposta_confirmacao", label: "Sem resposta confirmação", shortLabel: "Sem resp.", phase: "pre_consulta", order: 34 },
  { code: "motivo_nao_confirmacao", label: "Motivo não confirmação", shortLabel: "Motivo", phase: "pre_consulta", order: 35 },
  { code: "consulta_confirmada", label: "Consulta confirmada", shortLabel: "Confirmada", phase: "pre_consulta", order: 36 },
  { code: "lembrete_dia_enviado", label: "Lembrete no dia", shortLabel: "Dia", phase: "pre_consulta", order: 37 },
  { code: "reagendamento_confirmado", label: "Reagendamento", shortLabel: "Remarcar", phase: "pre_consulta", order: 38 },
  { code: "formulario_pendente", label: "Formulário pendente", shortLabel: "Formulário", phase: "pre_consulta", order: 39 },
  { code: "formulario_ok", label: "Formulário respondido", shortLabel: "Form ok", phase: "pre_consulta", order: 40 },
  { code: "checkin_pendente", label: "Check-in pendente", shortLabel: "Check-in", phase: "consulta", order: 50 },
  { code: "em_atendimento", label: "Em atendimento", shortLabel: "Atendimento", phase: "consulta", order: 51 },
  { code: "consulta_realizada", label: "Consulta realizada", shortLabel: "Realizada", phase: "consulta", order: 52 },
  { code: "consulta_falta", label: "Falta registrada", shortLabel: "Falta", phase: "consulta", order: 53 },
  { code: "consulta_cancelada", label: "Consulta cancelada", shortLabel: "Cancelada", phase: "consulta", order: 54 },
  { code: "pagamento_pendente", label: "Pagamento pendente", shortLabel: "A receber", phase: "financeiro", order: 60 },
  { code: "pagamento_parcial", label: "Pagamento parcial", shortLabel: "Parcial", phase: "financeiro", order: 61 },
  { code: "pago", label: "Pago", shortLabel: "Pago", phase: "financeiro", order: 62 },
  { code: "retorno_sugerido", label: "Retorno sugerido", shortLabel: "Retorno", phase: "pos_consulta", order: 70 },
  { code: "retorno_agendado", label: "Retorno agendado", shortLabel: "Retorno ok", phase: "pos_consulta", order: 71 },
  { code: "plano_tratamento_ativo", label: "Plano de tratamento ativo", shortLabel: "Plano", phase: "pos_consulta", order: 72 },
  { code: "jornada_concluida", label: "Jornada concluída", shortLabel: "Concluída", phase: "pos_consulta", order: 73 },
  { code: "pesquisa_nps_enviada", label: "Pesquisa NPS enviada", shortLabel: "NPS", phase: "pos_atendimento", order: 80 },
  { code: "feedback_recebido", label: "Feedback recebido", shortLabel: "Feedback", phase: "pos_atendimento", order: 81 },
];

const STEP_BY_CODE = new Map(JOURNEY_STEPS.map((s) => [s.code, s]));

export function getStepDefinition(code: JourneyStepCode): JourneyStepDefinition {
  return STEP_BY_CODE.get(code) ?? JOURNEY_STEPS[0];
}

export function getCompletedStepsUpTo(current: JourneyStepCode): JourneyStepCode[] {
  const currentOrder = getStepDefinition(current).order;
  return JOURNEY_STEPS.filter((s) => s.order < currentOrder).map((s) => s.code);
}

export function encodeContactKey(contactType: "lead" | "patient", id: string): string {
  return `${contactType}-${id}`;
}

export function getJourneyHrefFromEvent(event: {
  patient_id?: string | null;
  metadata?: Record<string, unknown>;
}): string | null {
  if (event.patient_id) {
    return `/dashboard/crm/jornada/${encodeContactKey("patient", event.patient_id)}`;
  }
  const email = (event.metadata?.public_submitter_email as string) || null;
  if (email) {
    return `/dashboard/crm/jornada?email=${encodeURIComponent(email)}`;
  }
  return null;
}

export function decodeContactKey(key: string): { contactType: "lead" | "patient"; id: string } | null {
  const match = key.match(/^(lead|patient)-(.+)$/);
  if (!match) return null;
  return { contactType: match[1] as "lead" | "patient", id: match[2] };
}

export const PIPELINE_STAGE_TO_STEP: Record<string, JourneyStepCode> = {
  novo_contato: "primeiro_contato",
  aguardando_retorno: "aguardando_retorno",
  cadastrado: "cadastrado",
  agendado: "consulta_agendada",
};

export const LIFECYCLE_TO_STEP: Record<string, JourneyStepCode> = {
  lead_novo: "primeiro_contato",
  em_qualificacao: "qualificacao",
  qualificado: "cadastrado",
  oportunidade: "consulta_agendada",
  cliente: "consulta_realizada",
  perdido: "objecao_identificada",
};

export const APPOINTMENT_STATUS_TO_STEP: Record<string, JourneyStepCode> = {
  agendada: "consulta_agendada",
  confirmada: "consulta_confirmada",
  realizada: "consulta_realizada",
  falta: "consulta_falta",
  cancelada: "consulta_cancelada",
};

export const QUOTE_STATUS_TO_STEP: Record<string, JourneyStepCode> = {
  rascunho: "orcamento_rascunho",
  enviado: "orcamento_enviado",
  aceito: "orcamento_aceito",
  recusado: "orcamento_recusado",
  expirado: "orcamento_vencido",
};

export const COMANDA_STATUS_TO_STEP: Record<string, JourneyStepCode> = {
  aberta: "pagamento_pendente",
  parcial: "pagamento_parcial",
  paga: "pago",
};

export const JOURNEY_SOURCE_LABELS: Record<string, string> = {
  form: "Formulário",
  whatsapp: "WhatsApp",
  whatsapp_direct: "WhatsApp direto",
  whatsapp_ads: "WhatsApp anúncio",
  site: "Site",
  public_site: "Site booking",
  manual: "Manual",
  indicacao: "Indicação",
  ligacao: "Ligação",
  campanha: "Campanha",
  reativacao_campanha: "Reativação campanha",
};
