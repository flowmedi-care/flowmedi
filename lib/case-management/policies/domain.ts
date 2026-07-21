import type { CasePhase } from "../types";
import type { DomainEventType } from "../events";

/** Domain Policies — regras estruturais do produto (não config de clínica). */

export type DomainPolicyContext = {
  eventType: string;
  currentPhase: CasePhase | null;
};

export type DomainPolicyResult = {
  allowed: boolean;
  suggestedPhase?: CasePhase;
  suggestPaymentRequested?: boolean;
  createTaskTitles?: string[];
  reason?: string;
};

const PHASE_AFTER_EVENT: Partial<Record<DomainEventType, CasePhase>> = {
  "Lead.Qualified": "comercial",
  "Lead.Disqualified": "perdido",
  "Lead.Converted": "consulta",
  "Appointment.Created": "consulta",
  "Appointment.Confirmed": "consulta",
  "Appointment.Completed": "financeiro",
  "Appointment.NoShow": "reengajamento",
  "Appointment.Cancelled": "reengajamento",
  "Payment.Paid": "pos",
  "Payment.PartiallyPaid": "financeiro",
  "Payment.Created": "financeiro",
  "Form.Completed": undefined,
};

export function evaluateDomainPolicy(ctx: DomainPolicyContext): DomainPolicyResult {
  const suggestedPhase = PHASE_AFTER_EVENT[ctx.eventType as DomainEventType];

  if (ctx.eventType === "Appointment.Completed") {
    return {
      allowed: true,
      suggestedPhase: "financeiro",
      suggestPaymentRequested: true,
      createTaskTitles: ["Receber pagamento"],
    };
  }

  if (ctx.eventType === "Lead.Qualified") {
    return {
      allowed: true,
      suggestedPhase: "comercial",
      createTaskTitles: ["Enviar orçamento / agendar"],
    };
  }

  if (ctx.eventType === "Case.OverrideRequested") {
    return { allowed: true, reason: "override_humano" };
  }

  return {
    allowed: true,
    suggestedPhase,
  };
}

/** Rebuild phase from ordered domain event types (PhasePolicy estrutural). */
export function derivePhaseFromEventTypes(eventTypes: string[]): CasePhase {
  let phase: CasePhase = "captacao";
  for (const t of eventTypes) {
    const next = PHASE_AFTER_EVENT[t as DomainEventType];
    if (next) phase = next;
  }
  return phase;
}
