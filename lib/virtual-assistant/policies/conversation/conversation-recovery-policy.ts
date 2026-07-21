/**
 * Conversation Recovery — core capability / middleware conversacional.
 * Progressive Resolution + Confidence state machine.
 * No side effects: recoverConversation / decide* only return decisions.
 */

export type ConfidenceLevel = "high" | "low" | "recovering" | "handoff";

export type ConversationConfidence = {
  level: ConfidenceLevel;
  consecutive_failures: number;
};

export type ConversationRecoveryPolicy = {
  /** Failures before offering handoff (default 2). */
  handoffAfterFailures: number;
  proactiveHandoffCopy: string;
};

export type ConversationRecoveryPolicyInput = Partial<ConversationRecoveryPolicy>;

export type RecoverConversationInput = {
  /** Internal / patient-facing reason key or short description */
  reason: string;
  /** Patient-facing explanation of what failed (contextual) */
  patientFacingReason?: string;
  retry?: boolean;
  alternative?: string;
  handoff?: boolean;
  confidence: ConversationConfidence;
};

export type ConversationRecoveryDecision = {
  patientReply: string;
  retry: boolean;
  alternative?: string;
  offerHandoff: boolean;
  nextConfidence: ConversationConfidence;
  action: "retry" | "alternative" | "offer_handoff" | "explain";
};

export const DEFAULT_PROACTIVE_HANDOFF_COPY =
  "Se preferir, posso encaminhar sua conversa agora para um de nossos atendentes, sem você precisar explicar tudo novamente.";

const GENERIC_UNAVAILABLE =
  "Esta informação não está disponível pelo assistente no momento.";

export function getDefaultConversationRecoveryPolicy(): ConversationRecoveryPolicy {
  return {
    handoffAfterFailures: 2,
    proactiveHandoffCopy: DEFAULT_PROACTIVE_HANDOFF_COPY,
  };
}

export function mergeConversationRecoveryPolicy(
  input?: ConversationRecoveryPolicyInput | null
): ConversationRecoveryPolicy {
  const base = getDefaultConversationRecoveryPolicy();
  if (!input) return base;
  return {
    handoffAfterFailures: input.handoffAfterFailures ?? base.handoffAfterFailures,
    proactiveHandoffCopy:
      input.proactiveHandoffCopy?.trim() || base.proactiveHandoffCopy,
  };
}

export function getDefaultConfidence(): ConversationConfidence {
  return { level: "high", consecutive_failures: 0 };
}

export function normalizeConfidence(
  raw: Partial<ConversationConfidence> | null | undefined
): ConversationConfidence {
  const level = raw?.level;
  if (
    level === "high" ||
    level === "low" ||
    level === "recovering" ||
    level === "handoff"
  ) {
    return {
      level,
      consecutive_failures: Math.max(0, Number(raw?.consecutive_failures) || 0),
    };
  }
  return getDefaultConfidence();
}

/** Record a successful tool/turn — move toward HIGH. */
export function recordConversationSuccess(
  confidence: ConversationConfidence
): ConversationConfidence {
  if (confidence.level === "handoff") {
    return { level: "recovering", consecutive_failures: 0 };
  }
  if (confidence.level === "low" || confidence.level === "recovering") {
    return { level: "high", consecutive_failures: 0 };
  }
  return { level: "high", consecutive_failures: 0 };
}

/**
 * Core API — platform-wide recovery copy + confidence transition.
 */
export function recoverConversation(
  policy: ConversationRecoveryPolicy,
  input: RecoverConversationInput
): ConversationRecoveryDecision {
  const failures = input.confidence.consecutive_failures + 1;
  const forceHandoff =
    Boolean(input.handoff) || failures >= policy.handoffAfterFailures;

  const nextConfidence: ConversationConfidence = forceHandoff
    ? { level: "handoff", consecutive_failures: failures }
    : { level: "low", consecutive_failures: failures };

  const reasonText =
    sanitizePatientReason(input.patientFacingReason) ||
    sanitizePatientReason(input.reason) ||
    "Não consegui concluir essa etapa.";

  if (forceHandoff) {
    return {
      patientReply: `${reasonText} ${policy.proactiveHandoffCopy}`.trim(),
      retry: false,
      offerHandoff: true,
      nextConfidence,
      action: "offer_handoff",
    };
  }

  if (input.retry) {
    return {
      patientReply: `${reasonText} Vou tentar novamente.`.trim(),
      retry: true,
      offerHandoff: false,
      nextConfidence,
      action: "retry",
    };
  }

  if (input.alternative?.trim()) {
    return {
      patientReply: `${reasonText} ${input.alternative.trim()}`.trim(),
      retry: false,
      alternative: input.alternative.trim(),
      offerHandoff: false,
      nextConfidence,
      action: "alternative",
    };
  }

  return {
    patientReply: `${reasonText} Me diga de outro jeito o que você precisa, ou posso te passar para a equipe.`.trim(),
    retry: false,
    offerHandoff: true,
    nextConfidence,
    action: "explain",
  };
}

function sanitizePatientReason(text: string | undefined): string {
  const t = text?.trim() ?? "";
  if (!t) return "";
  if (t === GENERIC_UNAVAILABLE || /não está disponível pelo assistente/i.test(t)) {
    return "";
  }
  return t;
}

/** Map common tool failure contexts to patient-facing reasons. */
export function patientReasonForToolFailure(opts: {
  toolName?: string;
  status?: string;
  message?: string;
  deterministicReason?: string;
}): string {
  const msg = opts.message?.trim() ?? "";
  if (msg && msg !== GENERIC_UNAVAILABLE && !/não está disponível pelo assistente/i.test(msg)) {
    return msg;
  }

  if (
    opts.toolName === "find_available_slots" ||
    opts.deterministicReason === "day_selected"
  ) {
    return "Não consegui localizar os horários dessa seleção.";
  }
  if (opts.toolName === "get_service_price") {
    return "Ainda não tenho essa informação de preço cadastrada.";
  }
  if (opts.status === "needs_input") {
    return "Ainda preciso de um detalhe para continuar.";
  }
  return "Não consegui concluir essa etapa agora.";
}

/**
 * Decide whether an absorb message should be rewritten via recovery
 * (generic unavailable / allowlist fail).
 */
export function shouldRewriteWithRecovery(message: string | undefined): boolean {
  const t = message?.trim() ?? "";
  if (!t) return false;
  return (
    t === GENERIC_UNAVAILABLE ||
    /não está disponível pelo assistente/i.test(t)
  );
}
