import type { Channel } from "../shared/channel";
import type { Intent } from "../shared/intent";
import type { ConsentRecord } from "../conversation/consent-record";

export type ConsentPolicyInput = {
  intent: Intent;
  channel: Channel;
  consent: ConsentRecord;
  requiresConsentForMessaging: boolean;
};

export function requiresConsent(input: ConsentPolicyInput): boolean {
  if (!input.requiresConsentForMessaging) return false;
  if (input.consent.status === "granted") return false;
  if (input.consent.status === "denied") return true;
  const transactionalIntents: Intent[] = ["booking", "crm", "handoff"];
  return transactionalIntents.includes(input.intent);
}

export function canProceedAfterConsent(consent: ConsentRecord): boolean {
  return consent.status === "granted";
}
