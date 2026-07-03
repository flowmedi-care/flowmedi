import { JOURNEY_STEPS } from "@/lib/contact-journey/steps";

/** Matriz de cobertura CRM — alinhada com lib/virtual-assistant/agent-pipeline/stages.ts */

export type JourneyCoverageKind =
  | "ia_tool"
  | "ia_partial"
  | "event_auto"
  | "human_only"
  | "not_covered";

export type JourneyCoverageRow = {
  step: string;
  label: string;
  phase: string;
  coverage: JourneyCoverageKind;
  detail: string;
};

const STEP_COVERAGE: Partial<Record<string, { coverage: JourneyCoverageKind; detail: string }>> = {
  primeiro_contato: { coverage: "ia_tool", detail: "Conversa + list_procedures / list_services" },
  qualificacao: { coverage: "ia_tool", detail: "Conversa + preços" },
  informacoes_enviadas: { coverage: "ia_tool", detail: "get_procedure_info, list_price_options" },
  negociacao: { coverage: "ia_partial", detail: "Preços; orçamento formal via create_and_send_quote" },
  fechamento_agendamento: { coverage: "ia_tool", detail: "create_appointment" },
  cadastro_pendente: { coverage: "ia_tool", detail: "register_patient" },
  cadastrado: { coverage: "ia_tool", detail: "register_patient + agendar" },
  orcamento_enviado: { coverage: "ia_tool", detail: "create_and_send_quote + evento quote_sent" },
  orcamento_rascunho: { coverage: "human_only", detail: "Painel Vendas → Orçamentos" },
  orcamento_aceito: { coverage: "human_only", detail: "Confirmação manual no painel" },
  consulta_agendada: { coverage: "ia_tool", detail: "create_appointment" },
  compliance_7d_enviado: { coverage: "event_auto", detail: "Cron confirmations.ts" },
  compliance_2d_enviado: { coverage: "event_auto", detail: "Cron confirmations.ts" },
  lembrete_dia_enviado: { coverage: "event_auto", detail: "Cron confirmations.ts" },
  consulta_confirmada: { coverage: "ia_tool", detail: "confirm_appointment" },
  consulta_cancelada: { coverage: "ia_tool", detail: "cancel_appointment" },
  reagendamento_confirmado: { coverage: "ia_tool", detail: "reschedule_appointment" },
  formulario_pendente: { coverage: "event_auto", detail: "Compliance form + form_linked (Configurações)" },
  formulario_ok: { coverage: "ia_partial", detail: "get_form_status (leitura)" },
  pagamento_pendente: { coverage: "ia_partial", detail: "get_payment_status (somente leitura)" },
  pago: { coverage: "event_auto", detail: "Recibo via payment_receipt_generated após humano registrar" },
  pesquisa_nps_enviada: { coverage: "ia_partial", detail: "collect_nps_feedback" },
  feedback_recebido: { coverage: "ia_tool", detail: "collect_nps_feedback" },
  reclamacao_escalada: { coverage: "ia_tool", detail: "transfer_to_human" },
};

export function buildJourneyCoverageMatrix(): JourneyCoverageRow[] {
  return JOURNEY_STEPS.map((step) => {
    const mapped = STEP_COVERAGE[step.code];
    return {
      step: step.code,
      label: step.label,
      phase: step.phase,
      coverage: mapped?.coverage ?? "not_covered",
      detail: mapped?.detail ?? "Sem automação IA — equipe ou futuro",
    };
  });
}

export const COVERAGE_LABELS: Record<JourneyCoverageKind, string> = {
  ia_tool: "IA (ferramenta)",
  ia_partial: "IA parcial",
  event_auto: "Evento automático",
  human_only: "Somente humano",
  not_covered: "Não coberto",
};
