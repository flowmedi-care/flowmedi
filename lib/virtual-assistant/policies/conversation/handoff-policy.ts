/**
 * HandoffPolicy — when/how to leave AI for a human (channel-agnostic).
 * No side effects: decide* returns HandoffDecision. Consumers send / setOwner / route.
 */

export type HandoffOwnership = "assign_routing" | "unassigned";
export type HandoffKind = "temporary" | "opt_out";

export type HandoffPolicy = {
  enabled: boolean;
  transferCopy: string;
  optOutCopy: string;
  outsideHoursCopy: string;
  failureEscalationCopy: string;
  /** Prefer routing assignment after transfer */
  defaultOwnership: HandoffOwnership;
};

export type HandoffPolicyInput = Partial<HandoffPolicy>;

export type HandoffDecision =
  | {
      action: "stay_with_ai";
      reason: string;
      patientReply?: string;
    }
  | {
      action: "transfer";
      reason: string;
      patientReply: string;
      ownership: HandoffOwnership;
      pauseAi: true;
      kind: HandoffKind;
    };

export type HandoffTrigger =
  | "explicit_request"
  | "user_opt_out"
  | "tool_transfer"
  | "consecutive_tool_failures"
  | "bot_loop"
  | "complaint";

export type HandoffContext = {
  trigger: HandoffTrigger;
  insideHours: boolean;
  /** Booking in progress with ordinal/selection — block transfer for soft triggers */
  bookingSelectionInProgress?: boolean;
  explicitHumanRequest?: boolean;
};

export const DEFAULT_HANDOFF_TRANSFER_COPY =
  "Vou te passar para alguém da equipe. Em instantes alguém continua daqui.";

export const DEFAULT_HANDOFF_OPT_OUT_COPY =
  "Pronto! Desativei as respostas automáticas. Quando quiser voltar, envie ATIVAR.";

export const DEFAULT_HANDOFF_OUTSIDE_HOURS_COPY =
  "No momento a equipe não está disponível para atendimento humano. Posso ajudar por aqui ou você pode deixar sua mensagem que retornamos no próximo horário útil.";

export const DEFAULT_HANDOFF_FAILURE_COPY =
  "Vou te passar para alguém da equipe. Em instantes alguém continua daqui.";

export function getDefaultHandoffPolicy(): HandoffPolicy {
  return {
    enabled: true,
    transferCopy: DEFAULT_HANDOFF_TRANSFER_COPY,
    optOutCopy: DEFAULT_HANDOFF_OPT_OUT_COPY,
    outsideHoursCopy: DEFAULT_HANDOFF_OUTSIDE_HOURS_COPY,
    failureEscalationCopy: DEFAULT_HANDOFF_FAILURE_COPY,
    defaultOwnership: "assign_routing",
  };
}

export function mergeHandoffPolicy(input?: HandoffPolicyInput | null): HandoffPolicy {
  const base = getDefaultHandoffPolicy();
  if (!input) return base;
  return {
    enabled: input.enabled ?? base.enabled,
    transferCopy: input.transferCopy?.trim() || base.transferCopy,
    optOutCopy: input.optOutCopy?.trim() || base.optOutCopy,
    outsideHoursCopy: input.outsideHoursCopy?.trim() || base.outsideHoursCopy,
    failureEscalationCopy:
      input.failureEscalationCopy?.trim() || base.failureEscalationCopy,
    defaultOwnership: input.defaultOwnership ?? base.defaultOwnership,
  };
}

export function decideHandoff(
  policy: HandoffPolicy,
  ctx: HandoffContext
): HandoffDecision {
  if (!policy.enabled && ctx.trigger !== "user_opt_out") {
    return { action: "stay_with_ai", reason: "handoff_disabled" };
  }

  if (
    ctx.bookingSelectionInProgress &&
    !ctx.explicitHumanRequest &&
    (ctx.trigger === "explicit_request" || ctx.trigger === "tool_transfer")
  ) {
    return {
      action: "stay_with_ai",
      reason: "booking_selection_in_progress",
    };
  }

  if (ctx.trigger === "user_opt_out") {
    return {
      action: "transfer",
      reason: "user_opt_out",
      patientReply: policy.optOutCopy,
      ownership: "unassigned",
      pauseAi: true,
      kind: "opt_out",
    };
  }

  if (!ctx.insideHours) {
    return {
      action: "stay_with_ai",
      reason: "outside_handoff_hours",
      patientReply: policy.outsideHoursCopy,
    };
  }

  const kind: HandoffKind = "temporary";
  const ownership = policy.defaultOwnership;

  if (ctx.trigger === "consecutive_tool_failures" || ctx.trigger === "bot_loop") {
    return {
      action: "transfer",
      reason: ctx.trigger,
      patientReply: policy.failureEscalationCopy,
      ownership,
      pauseAi: true,
      kind,
    };
  }

  return {
    action: "transfer",
    reason: ctx.trigger,
    patientReply: policy.transferCopy,
    ownership,
    pauseAi: true,
    kind,
  };
}
