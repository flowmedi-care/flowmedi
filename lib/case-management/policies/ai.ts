import { AI_INTENT_EVENTS, isDomainFactBlockedForAi, type DomainEventType } from "../events";

/**
 * AI Policies — IA emite Intents, nunca Domain Facts de módulo.
 */

export type AIPolicyConfig = {
  canQualify: boolean;
  canDisqualify: boolean;
  canReschedule: boolean;
  canRequestPayment: boolean;
  allowedIntentEvents: string[];
};

export const DEFAULT_AI_POLICY: AIPolicyConfig = {
  canQualify: true,
  canDisqualify: false,
  canReschedule: false,
  canRequestPayment: false,
  allowedIntentEvents: [...AI_INTENT_EVENTS],
};

export function resolveAIPolicy(
  overrides?: Partial<AIPolicyConfig> | null
): AIPolicyConfig {
  return {
    ...DEFAULT_AI_POLICY,
    ...overrides,
    allowedIntentEvents:
      overrides?.allowedIntentEvents ?? DEFAULT_AI_POLICY.allowedIntentEvents,
  };
}

/**
 * Gate: só intents; facts de Agenda/Financeiro bloqueados.
 * Lead.Disqualified exige canDisqualify explícito.
 */
export function aiMayPublishEvent(
  policy: AIPolicyConfig,
  eventType: string
): boolean {
  if (isDomainFactBlockedForAi(eventType)) return false;

  if (!policy.allowedIntentEvents.includes(eventType)) {
    return false;
  }

  if (eventType === "Lead.Qualified" && !policy.canQualify) return false;
  if (eventType === "Lead.Disqualified" && !policy.canDisqualify) return false;
  if (eventType === "PaymentRequested" && !policy.canRequestPayment) return false;

  return true;
}

/** @deprecated compat — use allowedIntentEvents */
export type AIPolicyConfigLegacy = AIPolicyConfig & {
  allowedDomainEvents?: DomainEventType[];
};
