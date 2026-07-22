/**
 * resolveNextAction — função PURA (Lei 2 / RFC P0).
 * Entrada: Case + Tasks + Appointment (já carregados).
 * Saída: ResolvedNextAction | null.
 * Sem banco, sem Journey legado, sem effects.
 */

import type { CaseTask, JourneyCase, PendingDecision } from "./types";

export type AppointmentNextInput = {
  id: string;
  scheduledAt: string;
  status: string;
} | null;

export type ResolvedNextAction = {
  label: string;
  waitingFor: string | null;
  dueAt: string | null;
  source: "pending_decision" | "task" | "appointment";
  appointmentId?: string | null;
};

export function humanizeDecisionType(type: string): string {
  const map: Record<string, string> = {
    confirm_appointment: "Confirmar consulta",
    reschedule: "Remarcar consulta",
    advance_commercial: "Avançar comercial / agendar",
    qualify_lead: "Qualificar contato",
    collect_payment: "Cobrar / receber",
    handoff: "Assumir atendimento",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

const HUMAN_WAITING = new Set(["secretaria", "human", "medico", "admin"]);

export function pendingRequiresHumanDecision(
  pd: PendingDecision | null | undefined
): boolean {
  if (!pd) return false;
  const w = (pd.waiting_for || "").toLowerCase();
  if (!w) return true;
  if (w === "patient" || w === "ai" || w === "system") return false;
  return HUMAN_WAITING.has(w) || w.includes("secretar") || w.includes("human");
}

export function resolveNextAction(
  c: Pick<JourneyCase, "pending_decision">,
  openTasks: Pick<CaseTask, "title" | "due_at" | "status" | "assignee_role">[] = [],
  appointment: AppointmentNextInput = null
): ResolvedNextAction | null {
  const pd = c.pending_decision;
  if (pd) {
    return {
      label: pd.label?.trim() || humanizeDecisionType(pd.type),
      waitingFor: pd.waiting_for,
      dueAt: pd.due_at ?? null,
      source: "pending_decision",
      appointmentId: null,
    };
  }

  const open = openTasks
    .filter((t) => t.status === "open")
    .sort((a, b) => {
      if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
      if (a.due_at) return -1;
      if (b.due_at) return 1;
      return 0;
    });
  const first = open[0];
  if (first) {
    return {
      label: first.title,
      waitingFor: first.assignee_role,
      dueAt: first.due_at,
      source: "task",
      appointmentId: null,
    };
  }

  if (appointment && appointment.status === "agendada") {
    return {
      label: "Confirmar consulta",
      waitingFor: "secretaria",
      dueAt: appointment.scheduledAt,
      source: "appointment",
      appointmentId: appointment.id,
    };
  }

  return null;
}

export function caseRequiresHumanNextAction(
  c: Pick<JourneyCase, "pending_decision">,
  openTasks: Pick<CaseTask, "title" | "due_at" | "status" | "assignee_role">[] = [],
  appointment: AppointmentNextInput = null
): boolean {
  const next = resolveNextAction(c, openTasks, appointment);
  if (!next) return false;
  if (next.source === "pending_decision") {
    return pendingRequiresHumanDecision(c.pending_decision);
  }
  if (next.source === "appointment") return true;
  const role = (next.waitingFor || "").toLowerCase();
  if (role === "ai" || role === "system" || role === "patient") return false;
  return true;
}
