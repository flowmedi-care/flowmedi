import type { PipelineItem } from "@/app/dashboard/pipeline/actions";
import {
  getEffectiveLifecycleStage,
  type LeadTemperature,
  type LifecycleStage,
} from "./lifecycle";

export type { LeadTemperature };

export type ScoreBreakdownItem = {
  label: string;
  points: number;
};

export type LeadScoreResult = {
  score: number;
  temperature: LeadTemperature;
  effectiveTemperature: LeadTemperature;
  breakdown: ScoreBreakdownItem[];
};

const MS_PER_DAY = 86_400_000;

function scoreToTemperature(score: number): LeadTemperature {
  if (score <= 33) return "frio";
  if (score <= 66) return "morno";
  return "quente";
}

function temperatureRank(t: LeadTemperature): number {
  return t === "quente" ? 3 : t === "morno" ? 2 : 1;
}

export function getEffectiveTemperature(
  score: number,
  override: LeadTemperature | null | undefined
): LeadTemperature {
  if (override) return override;
  return scoreToTemperature(score);
}

export type ScoringInput = {
  lifecycle_stage?: LifecycleStage;
  last_contact_at?: string | null;
  next_action?: string | null;
  next_action_at?: string | null;
  loss_reason?: string | null;
  temperature_override?: LeadTemperature | null;
  hasSentQuote?: boolean;
  hasConfirmedAppointmentSoon?: boolean;
  hasPendingForm?: boolean;
  stage?: string;
  lifecycle_stage_raw?: string | null;
  history?: PipelineItem["history"];
};

export function computeLeadScore(input: ScoringInput): LeadScoreResult {
  const lifecycle = input.lifecycle_stage ?? "lead_novo";
  const breakdown: ScoreBreakdownItem[] = [];
  let score = 0;

  if (lifecycle === "perdido" || input.loss_reason) {
    return {
      score: 0,
      temperature: "frio",
      effectiveTemperature: input.temperature_override ?? "frio",
      breakdown: [{ label: "Lead perdido", points: 0 }],
    };
  }

  const now = Date.now();

  if (input.last_contact_at) {
    const hoursSince =
      (now - new Date(input.last_contact_at).getTime()) / (1000 * 60 * 60);
    if (hoursSince <= 24) {
      breakdown.push({ label: "Contato nas últimas 24h", points: 25 });
      score += 25;
    }
  }

  if (input.next_action_at) {
    const actionDate = new Date(input.next_action_at).getTime();
    if (actionDate <= now + MS_PER_DAY) {
      breakdown.push({ label: "Follow-up pendente ou hoje", points: 20 });
      score += 20;
    }
  } else if (input.next_action?.trim()) {
    breakdown.push({ label: "Próxima ação definida", points: 10 });
    score += 10;
  }

  if (input.hasSentQuote) {
    breakdown.push({ label: "Orçamento enviado aguardando resposta", points: 15 });
    score += 15;
  }

  if (input.hasConfirmedAppointmentSoon) {
    breakdown.push({ label: "Consulta confirmada em até 3 dias", points: 20 });
    score += 20;
  }

  if (input.hasPendingForm) {
    breakdown.push({ label: "Formulário pendente antes da consulta", points: 10 });
    score += 10;
  }

  if (lifecycle === "lead_novo") {
    breakdown.push({ label: "Lead novo na fila", points: 15 });
    score += 15;
  }

  if (lifecycle === "oportunidade") {
    breakdown.push({ label: "Oportunidade ativa", points: 10 });
    score += 10;
  }

  const lastActivity = input.last_contact_at
    ? new Date(input.last_contact_at).getTime()
    : null;
  if (
    lastActivity &&
    lifecycle === "em_qualificacao" &&
    now - lastActivity > 7 * MS_PER_DAY
  ) {
    breakdown.push({ label: "Sem resposta há mais de 7 dias", points: -30 });
    score -= 30;
  }

  score = Math.max(0, Math.min(100, score));
  const temperature = scoreToTemperature(score);
  const effectiveTemperature = getEffectiveTemperature(score, input.temperature_override);

  return { score, temperature, effectiveTemperature, breakdown };
}

export function computePipelineItemScore(item: PipelineItem): LeadScoreResult {
  const lifecycle = getEffectiveLifecycleStage(item);
  return computeLeadScore({
    lifecycle_stage: lifecycle,
    last_contact_at: item.last_contact_at,
    next_action: item.next_action,
    next_action_at: item.next_action_at,
    loss_reason: item.loss_reason,
    temperature_override: item.temperature_override as LeadTemperature | null,
    stage: item.stage,
    history: item.history,
    hasSentQuote: item.has_sent_quote,
    hasConfirmedAppointmentSoon: item.has_confirmed_appointment_soon,
    hasPendingForm: item.has_pending_form,
  });
}

export function sortByEffectiveTemperature(
  items: PipelineItem[]
): PipelineItem[] {
  return [...items].sort((a, b) => {
    const scoreA = computePipelineItemScore(a);
    const scoreB = computePipelineItemScore(b);
    const tempDiff =
      temperatureRank(scoreB.effectiveTemperature) -
      temperatureRank(scoreA.effectiveTemperature);
    if (tempDiff !== 0) return tempDiff;
    return scoreB.score - scoreA.score;
  });
}

export const TEMPERATURE_LABELS: Record<LeadTemperature, string> = {
  frio: "Frio",
  morno: "Morno",
  quente: "Quente",
};
