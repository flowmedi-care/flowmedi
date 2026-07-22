/**
 * NextDecision — próximo trabalho do Case (propriedade dinâmica, não entidade).
 * Persistência atual: journey_cases.pending_decision (JSONB) via adapter.
 */

import type { OwnerType, PendingDecision } from "./types";

export type DecisionDecider = "ai" | "patient" | "human" | "system";

export type NextDecision = {
  action: string;
  label: string;
  decider: DecisionDecider;
  dueAt: string | null;
  urgent: boolean;
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

export function humanizeNextDecisionAction(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

export function waitingForToDecider(waitingFor: string | null | undefined): DecisionDecider {
  const w = (waitingFor || "").toLowerCase();
  if (!w) return "human";
  if (w === "patient" || w === "patient_waiting") return "patient";
  if (w === "ai" || w.startsWith("ai")) return "ai";
  if (w === "system") return "system";
  if (HUMAN_WAITING.has(w) || w.includes("secretar") || w.includes("human")) return "human";
  return "human";
}

export function ownerTypeToDecider(ownerType: OwnerType | string | null | undefined): DecisionDecider {
  if (ownerType === "ai") return "ai";
  if (ownerType === "patient") return "patient";
  if (ownerType === "human") return "human";
  return "system";
}

export function isUrgentDue(dueAt: string | null | undefined, now = Date.now()): boolean {
  if (!dueAt) return false;
  const t = new Date(dueAt).getTime();
  if (Number.isNaN(t)) return false;
  return t <= now + 24 * 60 * 60 * 1000;
}

/** pending_decision (DB) → NextDecision (domínio de produto) */
export function pendingToNextDecision(
  pending: PendingDecision | null | undefined
): NextDecision | null {
  if (!pending) return null;
  const action = pending.type || "pending";
  return {
    action,
    label: pending.label?.trim() || humanizeNextDecisionAction(action),
    decider: waitingForToDecider(pending.waiting_for),
    dueAt: pending.due_at ?? null,
    urgent: isUrgentDue(pending.due_at),
  };
}

/** NextDecision → pending_decision (persistência) */
export function nextDecisionToPending(next: NextDecision): PendingDecision {
  const waiting_for =
    next.decider === "human"
      ? "secretaria"
      : next.decider === "patient"
        ? "patient"
        : next.decider;
  return {
    type: next.action,
    waiting_for,
    label: next.label,
    due_at: next.dueAt,
  };
}

export function getCaseNextDecision(input: {
  pending_decision?: PendingDecision | null;
}): NextDecision | null {
  return pendingToNextDecision(input.pending_decision);
}

/** Agrupamento de UI: ação → rótulo curto de CTA */
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
