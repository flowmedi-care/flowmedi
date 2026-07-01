import { getStepDefinition, JOURNEY_PHASE_ORDER } from "./steps";
import { getStepMetadata } from "./step-metadata";
import type {
  ActivePathStep,
  ComandaSnapshot,
  ContactIntent,
  JourneyStepCode,
  ParallelTrack,
  QuoteSnapshot,
} from "./types";

export type PathTemplateId =
  | "captacao"
  | "pre_consulta"
  | "consulta"
  | "financeiro_pos"
  | "reativacao"
  | "suporte"
  | "pos_atendimento"
  | "reengajamento";

export const PATH_TEMPLATES: Record<PathTemplateId, JourneyStepCode[]> = {
  captacao: [
    "origem_identificada",
    "primeiro_contato",
    "qualificacao",
    "informacoes_enviadas",
    "negociacao",
    "fechamento_agendamento",
  ],
  pre_consulta: [
    "consulta_agendada",
    "agradecimento_agendamento",
    "compliance_7d_enviado",
    "compliance_2d_enviado",
    "consulta_confirmada",
    "lembrete_dia_enviado",
    "formulario_pendente",
    "formulario_ok",
  ],
  consulta: ["checkin_pendente", "em_atendimento", "consulta_realizada"],
  financeiro_pos: ["pagamento_pendente", "pagamento_parcial", "pago"],
  reativacao: ["reativacao_iniciada", "qualificacao", "fechamento_agendamento"],
  suporte: ["suporte_iniciado", "suporte_concluido"],
  pos_atendimento: ["pesquisa_nps_enviada", "feedback_recebido"],
  reengajamento: ["repescagem_ativa", "reativacao_iniciada", "qualificacao"],
};

const STEP_TO_TEMPLATE: Partial<Record<JourneyStepCode, PathTemplateId>> = {};

for (const [templateId, steps] of Object.entries(PATH_TEMPLATES) as [PathTemplateId, JourneyStepCode[]][]) {
  for (const step of steps) {
    STEP_TO_TEMPLATE[step] = templateId;
  }
}

const OUTCOME_STEPS: JourneyStepCode[] = [
  "objecao_identificada",
  "consulta_falta",
  "consulta_cancelada",
  "orcamento_recusado",
  "orcamento_vencido",
  "reclamacao_escalada",
  "jornada_concluida",
];

export function resolvePathTemplate(
  currentStep: JourneyStepCode,
  contactIntent: ContactIntent
): PathTemplateId {
  if (STEP_TO_TEMPLATE[currentStep]) {
    return STEP_TO_TEMPLATE[currentStep]!;
  }

  if (OUTCOME_STEPS.includes(currentStep)) {
    if (currentStep === "objecao_identificada" || currentStep === "orcamento_recusado") {
      return "reengajamento";
    }
    if (currentStep === "consulta_falta" || currentStep === "consulta_cancelada") {
      return "reengajamento";
    }
  }

  const phase = getStepDefinition(currentStep).phase;
  if (phase === "comercial") return "captacao";
  if (phase === "pre_consulta") return "pre_consulta";
  if (phase === "consulta") return "consulta";
  if (phase === "financeiro") return "financeiro_pos";
  if (phase === "pos_atendimento") return "pos_atendimento";
  if (phase === "reengajamento") return "reengajamento";
  if (contactIntent === "suporte") return "suporte";
  if (contactIntent === "reativacao") return "reativacao";

  return "captacao";
}

export function buildActivePathSteps(
  currentStep: JourneyStepCode,
  completedSteps: JourneyStepCode[],
  contactIntent: ContactIntent
): ActivePathStep[] {
  const templateId = resolvePathTemplate(currentStep, contactIntent);
  const template = PATH_TEMPLATES[templateId];
  const completedSet = new Set(completedSteps);
  const currentIndex = template.indexOf(currentStep);

  return template.map((code, index) => {
    const def = getStepDefinition(code);
    const meta = getStepMetadata(code);

    let status: ActivePathStep["status"];
    if (code === currentStep) {
      status = "current";
    } else if (completedSet.has(code) || (currentIndex >= 0 && index < currentIndex)) {
      status = "completed";
    } else {
      status = "upcoming";
    }

    return {
      code,
      label: def.label,
      shortLabel: def.shortLabel,
      status,
      awaitsResponse: code === currentStep ? meta.awaitsResponse : undefined,
      hint: code === currentStep ? meta.hint ?? meta.nextStepHint : undefined,
    };
  });
}

export function buildParallelTracks(input: {
  currentStep: JourneyStepCode;
  quotes?: QuoteSnapshot[];
  comandas?: ComandaSnapshot[];
  contactIntent: ContactIntent;
}): ParallelTrack[] {
  const tracks: ParallelTrack[] = [];
  const { quotes, comandas, currentStep } = input;

  const openQuote = quotes?.find((q) => ["enviado", "rascunho"].includes(q.status));
  const expiredQuote = quotes?.find((q) => q.status === "expirado");
  const pendingPayment = quotes?.some((q) => q.status === "aceito") || currentStep === "pagamento_sinal_pendente";

  if (openQuote || expiredQuote || pendingPayment || ["orcamento_enviado", "orcamento_rascunho", "pagamento_sinal_pendente", "comprovante_recebido"].includes(currentStep)) {
    const financeSteps: ParallelTrack["steps"] = [];
    const commercialFlow: JourneyStepCode[] = [
      "orcamento_rascunho",
      "orcamento_enviado",
      "pagamento_sinal_pendente",
      "comprovante_recebido",
    ];

    for (const code of commercialFlow) {
      const def = getStepDefinition(code);
      let status: ParallelTrack["steps"][0]["status"] = "upcoming";
      if (code === currentStep) status = "current";
      else if (getStepDefinition(currentStep).order > def.order) status = "completed";
      financeSteps.push({ code, label: def.shortLabel, status });
    }

    if (financeSteps.some((s) => s.status !== "upcoming")) {
      tracks.push({ kind: "financeiro", label: "Financeiro comercial", steps: financeSteps });
    }
  }

  if (input.contactIntent === "suporte" || ["suporte_iniciado", "suporte_concluido", "reclamacao_escalada"].includes(currentStep)) {
    tracks.push({
      kind: "suporte",
      label: "Suporte",
      steps: [
        {
          code: "suporte_iniciado",
          label: "Iniciado",
          status: ["suporte_concluido", "reclamacao_escalada"].includes(currentStep) ? "completed" : currentStep === "suporte_iniciado" ? "current" : "upcoming",
        },
        {
          code: "suporte_concluido",
          label: "Concluído",
          status: currentStep === "suporte_concluido" ? "current" : currentStep === "reclamacao_escalada" ? "upcoming" : "upcoming",
        },
      ],
    });
  }

  if (["pesquisa_nps_enviada", "feedback_recebido"].includes(currentStep) || input.contactIntent === "pos_atendimento") {
    tracks.push({
      kind: "pos_atendimento",
      label: "Pós-atendimento",
      steps: [
        {
          code: "pesquisa_nps_enviada",
          label: "NPS",
          status: currentStep === "feedback_recebido" ? "completed" : currentStep === "pesquisa_nps_enviada" ? "current" : "upcoming",
        },
        {
          code: "feedback_recebido",
          label: "Feedback",
          status: currentStep === "feedback_recebido" ? "current" : "upcoming",
        },
      ],
    });
  }

  const openComanda = comandas?.find((c) => ["aberta", "parcial"].includes(c.status));
  if (openComanda && !tracks.some((t) => t.kind === "financeiro")) {
    tracks.push({
      kind: "financeiro",
      label: "Financeiro operacional",
      steps: [
        {
          code: "pagamento_pendente",
          label: "A receber",
          status: currentStep === "pagamento_parcial" || currentStep === "pago" ? "completed" : currentStep === "pagamento_pendente" ? "current" : "upcoming",
        },
        {
          code: "pago",
          label: "Pago",
          status: currentStep === "pago" ? "current" : "upcoming",
        },
      ],
    });
  }

  return tracks;
}

export function getPhaseProgress(
  currentStep: JourneyStepCode,
  completedSteps: JourneyStepCode[]
): { phase: string; status: "completed" | "current" | "upcoming" }[] {
  const currentPhase = getStepDefinition(currentStep).phase;
  const currentPhaseIndex = JOURNEY_PHASE_ORDER.indexOf(currentPhase);
  const completedPhases = new Set(
    completedSteps.map((s) => getStepDefinition(s).phase)
  );

  return JOURNEY_PHASE_ORDER.map((phase, index) => {
    let status: "completed" | "current" | "upcoming";
    if (phase === currentPhase) status = "current";
    else if (completedPhases.has(phase) || index < currentPhaseIndex) status = "completed";
    else status = "upcoming";
    return { phase, status };
  });
}
