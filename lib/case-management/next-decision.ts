/**
 * NextDecision — próximo trabalho do Case (propriedade dinâmica, não entidade).
 * Persistência: journey_cases.pending_decision (JSONB) via adapter.
 *
 * owner (Case) = quem conduz | actor (nextDecision) = quem precisa decidir agora
 */

import type { OwnerType, PendingDecision } from "./types";

/** Quem precisa decidir / agir agora (≠ owner do Case) */
export type DecisionActor = "ai" | "patient" | "human" | "system";

/** @deprecated use DecisionActor */
export type DecisionDecider = DecisionActor;

export type NextDecision = {
  action: string;
  label: string;
  /** Quem precisa decidir agora */
  actor: DecisionActor;
  /** @deprecated use actor */
  decider: DecisionActor;
  dueAt: string | null;
  urgent: boolean;
  /** "Por que agora?" — texto curto */
  reason: string | null;
};

const HUMAN_WAITING = new Set(["secretaria", "human", "medico", "admin"]);

const ACTION_LABELS: Record<string, string> = {
  confirm_slot: "Confirmar consulta",
  confirm_appointment: "Confirmar consulta",
  reschedule: "Reagendar",
  advance_commercial: "Agendar consulta",
  qualify_lead: "Qualificar contato",
  collect_payment: "Cobrar / receber",
  handoff: "Assumir atendimento",
  send_reminder: "Enviar lembrete",
  call_again: "Ligar novamente",
  post_consult: "Pós-consulta",
};

const ACTOR_LABELS: Record<DecisionActor, string> = {
  ai: "IA",
  patient: "Paciente",
  human: "Recepção",
  system: "Sistema",
};

export function humanizeNextDecisionAction(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

export function actorLabel(actor: DecisionActor): string {
  return ACTOR_LABELS[actor];
}

export function waitingForToActor(waitingFor: string | null | undefined): DecisionActor {
  const w = (waitingFor || "").toLowerCase();
  if (!w) return "human";
  if (w === "patient" || w === "patient_waiting") return "patient";
  if (w === "ai" || w.startsWith("ai")) return "ai";
  if (w === "system") return "system";
  if (HUMAN_WAITING.has(w) || w.includes("secretar") || w.includes("human")) return "human";
  return "human";
}

/** @deprecated use waitingForToActor */
export const waitingForToDecider = waitingForToActor;

export function ownerTypeToActor(ownerType: OwnerType | string | null | undefined): DecisionActor {
  if (ownerType === "ai") return "ai";
  if (ownerType === "patient") return "patient";
  if (ownerType === "human") return "human";
  return "system";
}

/** @deprecated use ownerTypeToActor */
export const ownerTypeToDecider = ownerTypeToActor;

export function isUrgentDue(dueAt: string | null | undefined, now = Date.now()): boolean {
  if (!dueAt) return false;
  const t = new Date(dueAt).getTime();
  if (Number.isNaN(t)) return false;
  return t <= now + 24 * 60 * 60 * 1000;
}

export function formatWhyNow(
  dueAt: string | null | undefined,
  scheduledAt?: string | null
): string | null {
  const ref = dueAt || scheduledAt;
  if (!ref) return null;
  try {
    const d = new Date(ref);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const startTomorrow = new Date(startToday);
    startTomorrow.setDate(startTomorrow.getDate() + 1);
    const startDayAfter = new Date(startTomorrow);
    startDayAfter.setDate(startDayAfter.getDate() + 1);
    const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (d >= startToday && d < startTomorrow) return `hoje às ${time}`;
    if (d >= startTomorrow && d < startDayAfter) return `amanhã às ${time}`;
    const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    return `${date} às ${time}`;
  } catch {
    return null;
  }
}

/** pending_decision (DB) → NextDecision */
export function pendingToNextDecision(
  pending: PendingDecision | null | undefined,
  opts?: { scheduledAt?: string | null }
): NextDecision | null {
  if (!pending) return null;
  const action = pending.type || "pending";
  const dueAt = pending.due_at ?? null;
  const actor = waitingForToActor(pending.waiting_for);
  const reason = formatWhyNow(dueAt, opts?.scheduledAt ?? null);
  return {
    action,
    label: pending.label?.trim() || humanizeNextDecisionAction(action),
    actor,
    decider: actor,
    dueAt,
    urgent: isUrgentDue(dueAt),
    reason,
  };
}

/** NextDecision → pending_decision */
export function nextDecisionToPending(next: NextDecision): PendingDecision {
  const actor = next.actor ?? next.decider;
  const waiting_for =
    actor === "human" ? "secretaria" : actor === "patient" ? "patient" : actor;
  return {
    type: next.action,
    waiting_for,
    label: next.label,
    due_at: next.dueAt,
  };
}

export function getCaseNextDecision(
  input: { pending_decision?: PendingDecision | null },
  opts?: { scheduledAt?: string | null }
): NextDecision | null {
  return pendingToNextDecision(input.pending_decision, opts);
}

export function actionGroupLabel(action: string): string {
  const map: Record<string, string> = {
    confirm_slot: "Confirmar consultas",
    confirm_appointment: "Confirmar consultas",
    reschedule: "Reagendar",
    advance_commercial: "Agendar consultas",
    qualify_lead: "Qualificar contatos",
    collect_payment: "Cobrar",
    handoff: "Assumir atendimentos",
    send_reminder: "Enviar lembretes",
    call_again: "Ligar novamente",
    post_consult: "Pós-consulta",
  };
  return map[action] ?? humanizeNextDecisionAction(action);
}
