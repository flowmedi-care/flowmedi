/**
 * CaseProduct — face de produto do Case operacional.
 * Case → journey/stage → nextDecision; context para IA e "por quê".
 */

import type { OwnerType, PendingDecision } from "./types";
import {
  getCaseNextDecision,
  ownerTypeToActor,
  type NextDecision,
} from "./next-decision";

export type CaseProductContext = {
  patientId?: string | null;
  appointmentId?: string | null;
  conversationId?: string | null;
};

export type CaseProductView = {
  id: string;
  owner: OwnerType;
  /** Código da jornada (ex. appointment, primeira_consulta, tratamento) */
  journey: string;
  /** Stage / fase operacional (ex. awaiting_confirmation, pos_consulta) */
  stage: string;
  context: CaseProductContext;
  nextDecision: NextDecision | null;
};

export function toCaseProductView(input: {
  id: string;
  ownerType: OwnerType | string | null | undefined;
  journey?: string | null;
  stage?: string | null;
  patientId?: string | null;
  appointmentId?: string | null;
  conversationId?: string | null;
  pendingDecision?: PendingDecision | null;
  scheduledAt?: string | null;
}): CaseProductView {
  const owner = (input.ownerType as OwnerType) || "system";
  const nextDecision = getCaseNextDecision(
    { pending_decision: input.pendingDecision },
    { scheduledAt: input.scheduledAt ?? null }
  );
  return {
    id: input.id,
    owner,
    journey: (input.journey || "unknown").toLowerCase(),
    stage: (input.stage || "unknown").toLowerCase(),
    context: {
      patientId: input.patientId ?? null,
      appointmentId: input.appointmentId ?? null,
      conversationId: input.conversationId ?? null,
    },
    nextDecision,
  };
}

/** Owner label curto para UI */
export function caseOwnerLabel(owner: OwnerType | string): string {
  switch (owner) {
    case "ai":
      return "IA";
    case "human":
      return "Recepção";
    case "patient":
      return "Paciente";
    default:
      return "Sistema";
  }
}

export function caseConductorVsDecider(view: CaseProductView): {
  conductor: string;
  decider: string;
} {
  const actor = view.nextDecision?.actor ?? ownerTypeToActor(view.owner);
  return {
    conductor: caseOwnerLabel(view.owner),
    decider: actor === "human" ? "Recepção" : actor === "ai" ? "IA" : actor === "patient" ? "Paciente" : "Sistema",
  };
}
