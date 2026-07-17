import type { ConversationOpsRow, OperationsOwner } from "./types";

/**
 * Resolve o Responsável Atual a partir do banco.
 * Prefer fields nativos (ops_owner_*) quando presentes; senão deriva das flags.
 */
export function resolveOperationsOwner(row: ConversationOpsRow): {
  owner: OperationsOwner;
  ownerUserId: string | null;
} {
  if (row.ops_owner_type) {
    return {
      owner: row.ops_owner_type,
      ownerUserId: row.ops_owner_user_id ?? null,
    };
  }

  if (row.ai_user_opt_out) {
    return {
      owner: "human",
      ownerUserId: row.assigned_secretary_id ?? null,
    };
  }

  const aiActive =
    !row.ai_handoff_at &&
    row.ai_enabled !== false &&
    !row.ai_user_opt_out;

  if (aiActive && !row.assigned_secretary_id) {
    return { owner: "ai", ownerUserId: null };
  }

  if (row.assigned_secretary_id) {
    return { owner: "human", ownerUserId: row.assigned_secretary_id };
  }

  if (row.ai_handoff_at || row.ai_enabled === false) {
    return { owner: "human", ownerUserId: null };
  }

  // Última mensagem outbound e bola com paciente — derivado fraco; Fase 3 reforça.
  const aiState = row.ai_state ?? {};
  if (aiState.waiting_for_patient === true || aiState.patient_waiting === true) {
    return { owner: "patient_waiting", ownerUserId: null };
  }

  if (aiState.system_reminder_due || aiState.ops_owner === "system") {
    return { owner: "system", ownerUserId: null };
  }

  return { owner: "ai", ownerUserId: null };
}

export function ownerLabel(
  owner: OperationsOwner,
  humanName: string | null | undefined
): string {
  switch (owner) {
    case "ai":
      return "IA";
    case "system":
      return "Sistema";
    case "patient_waiting":
      return "Aguardando paciente";
    case "human":
      return humanName?.trim() || "Humano";
    default:
      return "Desconhecido";
  }
}

/** SLA padrão: 15 min após handoff / assign humano sem resposta outbound. */
export const DEFAULT_HUMAN_SLA_SECONDS = 15 * 60;

export function computeSla(input: {
  owner: OperationsOwner;
  aiHandoffAt: string | null;
  assignedAt: string | null;
  now?: Date;
}): { dueAt: string | null; secondsRemaining: number | null; breached: boolean } {
  if (input.owner !== "human" && input.owner !== "system") {
    return { dueAt: null, secondsRemaining: null, breached: false };
  }
  const anchor = input.aiHandoffAt || input.assignedAt;
  if (!anchor) {
    return { dueAt: null, secondsRemaining: null, breached: false };
  }
  const dueMs = new Date(anchor).getTime() + DEFAULT_HUMAN_SLA_SECONDS * 1000;
  const now = (input.now ?? new Date()).getTime();
  const secondsRemaining = Math.round((dueMs - now) / 1000);
  return {
    dueAt: new Date(dueMs).toISOString(),
    secondsRemaining,
    breached: secondsRemaining < 0,
  };
}
