import type { PipelineItem } from "@/app/dashboard/pipeline/actions";

export type LifecycleStage =
  | "lead_novo"
  | "em_qualificacao"
  | "qualificado"
  | "oportunidade"
  | "cliente"
  | "perdido";

export type QualificationType = "mql" | "sql";

export type LeadTemperature = "frio" | "morno" | "quente";

export const LIFECYCLE_STAGES: LifecycleStage[] = [
  "lead_novo",
  "em_qualificacao",
  "qualificado",
  "oportunidade",
  "cliente",
  "perdido",
];

export const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  lead_novo: "Lead novo",
  em_qualificacao: "Em qualificação",
  qualificado: "Qualificado",
  oportunidade: "Oportunidade",
  cliente: "Cliente",
  perdido: "Perdido",
};

export const LIFECYCLE_STAGE_SHORT_LABELS: Record<LifecycleStage, string> = {
  lead_novo: "Novo",
  em_qualificacao: "Qualificação",
  qualificado: "Qualificado",
  oportunidade: "Oportunidade",
  cliente: "Cliente",
  perdido: "Perdido",
};

export const QUALIFICATION_TYPE_LABELS: Record<QualificationType, string> = {
  mql: "MQL",
  sql: "SQL",
};

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  form: "Formulário",
  site: "Site",
  whatsapp: "WhatsApp",
  manual: "Manual",
};

/** Mapeia estágio legado do pipeline para lifecycle */
export function legacyStageToLifecycle(
  stage: string,
  lossReason?: string | null
): LifecycleStage {
  if (lossReason && stage === "aguardando_retorno") return "perdido";
  switch (stage) {
    case "novo_contato":
      return "lead_novo";
    case "aguardando_retorno":
      return "em_qualificacao";
    case "cadastrado":
      return "qualificado";
    case "agendado":
      return "oportunidade";
    default:
      return "lead_novo";
  }
}

/** Sincroniza estágio legado a partir do lifecycle (compatibilidade) */
export function lifecycleToLegacyStage(lifecycle: LifecycleStage): string {
  switch (lifecycle) {
    case "lead_novo":
      return "novo_contato";
    case "em_qualificacao":
    case "perdido":
      return "aguardando_retorno";
    case "qualificado":
      return "cadastrado";
    case "oportunidade":
    case "cliente":
      return "agendado";
    default:
      return "novo_contato";
  }
}

export type LifecycleDerivationInput = {
  lifecycle_stage?: string | null;
  stage?: string;
  loss_reason?: string | null;
  last_contact_at?: string | null;
  qualification_type?: string | null;
  hasCompletedAppointment?: boolean;
  hasScheduledAppointment?: boolean;
  hasActiveQuote?: boolean;
  history?: Array<{ action_type: string }>;
};

/** Resolve a etapa efetiva do funil (manual ou derivada) */
export function resolveLifecycleStage(input: LifecycleDerivationInput): LifecycleStage {
  if (input.lifecycle_stage && isLifecycleStage(input.lifecycle_stage)) {
    if (input.lifecycle_stage === "perdido") return "perdido";
    if (input.hasCompletedAppointment) return "cliente";
    if (input.hasScheduledAppointment && input.lifecycle_stage !== "cliente") {
      return rankLifecycle(input.lifecycle_stage) < rankLifecycle("oportunidade")
        ? "oportunidade"
        : input.lifecycle_stage;
    }
    return input.lifecycle_stage;
  }

  if (input.hasCompletedAppointment) return "cliente";
  if (input.hasScheduledAppointment) return "oportunidade";
  if (input.qualification_type || input.stage === "cadastrado") return "qualificado";
  if (input.loss_reason) return "perdido";
  if (input.last_contact_at || input.history?.some((h) => h.action_type === "contact_made")) {
    return "em_qualificacao";
  }

  return legacyStageToLifecycle(input.stage ?? "novo_contato", input.loss_reason);
}

function rankLifecycle(stage: LifecycleStage): number {
  return LIFECYCLE_STAGES.indexOf(stage);
}

export function isLifecycleStage(value: string): value is LifecycleStage {
  return (LIFECYCLE_STAGES as string[]).includes(value);
}

export function getEffectiveLifecycleStage(item: PipelineItem): LifecycleStage {
  return resolveLifecycleStage({
    lifecycle_stage: item.lifecycle_stage,
    stage: item.stage,
    loss_reason: item.loss_reason,
    last_contact_at: item.last_contact_at,
    qualification_type: item.qualification_type,
    history: item.history,
    hasScheduledAppointment: item.stage === "agendado",
    hasCompletedAppointment: item.lifecycle_stage === "cliente",
    hasActiveQuote: false,
  });
}

export function filterPipelineByLifecycle(
  items: PipelineItem[],
  lifecycle: LifecycleStage
): PipelineItem[] {
  return items.filter((item) => getEffectiveLifecycleStage(item) === lifecycle);
}

export function sortPipelineByScore(items: PipelineItem[]): PipelineItem[] {
  return [...items].sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0));
}
