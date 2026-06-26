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
  pre_consulta: "Pré-consulta",
  consulta: "Consulta",
  pos_consulta: "Pós-consulta",
};

export const JOURNEY_STEPS: JourneyStepDefinition[] = [
  { code: "primeiro_contato", label: "Primeiro contato", shortLabel: "Contato", phase: "captacao", order: 1 },
  { code: "aguardando_retorno", label: "Aguardando retorno", shortLabel: "Retorno", phase: "captacao", order: 2 },
  { code: "cadastro_pendente", label: "Cadastro pendente", shortLabel: "Cadastro", phase: "captacao", order: 3 },
  { code: "cadastrado", label: "Cadastrado", shortLabel: "Cadastrado", phase: "captacao", order: 4 },
  { code: "consulta_agendada", label: "Consulta agendada", shortLabel: "Agendada", phase: "pre_consulta", order: 5 },
  { code: "consulta_confirmada", label: "Consulta confirmada", shortLabel: "Confirmada", phase: "pre_consulta", order: 6 },
  { code: "formulario_pendente", label: "Formulário pendente", shortLabel: "Formulário", phase: "pre_consulta", order: 7 },
  { code: "formulario_ok", label: "Formulário respondido", shortLabel: "Form ok", phase: "pre_consulta", order: 8 },
  { code: "consulta_realizada", label: "Consulta realizada", shortLabel: "Realizada", phase: "consulta", order: 9 },
  { code: "consulta_falta", label: "Falta registrada", shortLabel: "Falta", phase: "consulta", order: 10 },
  { code: "consulta_cancelada", label: "Consulta cancelada", shortLabel: "Cancelada", phase: "consulta", order: 11 },
  { code: "retorno_sugerido", label: "Retorno sugerido", shortLabel: "Retorno", phase: "pos_consulta", order: 12 },
  { code: "retorno_agendado", label: "Retorno agendado", shortLabel: "Retorno ok", phase: "pos_consulta", order: 13 },
  { code: "jornada_concluida", label: "Jornada concluída", shortLabel: "Concluída", phase: "pos_consulta", order: 14 },
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

export const APPOINTMENT_STATUS_TO_STEP: Record<string, JourneyStepCode> = {
  agendada: "consulta_agendada",
  confirmada: "consulta_confirmada",
  realizada: "consulta_realizada",
  falta: "consulta_falta",
  cancelada: "consulta_cancelada",
};
