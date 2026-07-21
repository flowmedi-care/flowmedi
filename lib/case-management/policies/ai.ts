import { AI_ALLOWED_DOMAIN_EVENTS, type DomainEventType } from "../events";

/**
 * AI Policies — limites do agente.
 */

export type AIPolicyConfig = {
  canQualify: boolean;
  canDisqualify: boolean;
  canReschedule: boolean;
  canRequestPayment: boolean;
  allowedDomainEvents: DomainEventType[];
};

export const DEFAULT_AI_POLICY: AIPolicyConfig = {
  canQualify: true,
  canDisqualify: false,
  canReschedule: false,
  canRequestPayment: false,
  allowedDomainEvents: [...AI_ALLOWED_DOMAIN_EVENTS],
};

export function resolveAIPolicy(
  overrides?: Partial<AIPolicyConfig> | null
): AIPolicyConfig {
  return {
    ...DEFAULT_AI_POLICY,
    ...overrides,
    allowedDomainEvents:
      overrides?.allowedDomainEvents ?? DEFAULT_AI_POLICY.allowedDomainEvents,
  };
}

export function aiMayPublishEvent(
  policy: AIPolicyConfig,
  eventType: string
): boolean {
  if (!policy.allowedDomainEvents.includes(eventType as DomainEventType)) {
    return false;
  }
  if (eventType === "Lead.Qualified" && !policy.canQualify) return false;
  if (eventType === "Lead.Disqualified" && !policy.canDisqualify) return false;
  if (eventType === "PaymentRequested" && !policy.canRequestPayment) return false;
  return true;
}
