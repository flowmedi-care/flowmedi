export { evaluateDomainPolicy, derivePhaseFromEventTypes } from "./domain";
export type { DomainPolicyContext, DomainPolicyResult } from "./domain";
export { resolveClinicPolicy, DEFAULT_CLINIC_POLICY } from "./clinic";
export type { ClinicPolicyConfig } from "./clinic";
export { resolveAIPolicy, DEFAULT_AI_POLICY, aiMayPublishEvent } from "./ai";
export type { AIPolicyConfig } from "./ai";

import type { ClinicPolicyConfig } from "./clinic";
import type { AIPolicyConfig } from "./ai";
import { evaluateDomainPolicy, type DomainPolicyResult } from "./domain";
import type { CasePhase } from "../types";
import { resolveClinicPolicy } from "./clinic";
import { resolveAIPolicy, aiMayPublishEvent } from "./ai";

export type PolicyBundle = {
  clinic: ClinicPolicyConfig;
  ai: AIPolicyConfig;
};

export function buildPolicyBundle(opts?: {
  clinic?: Partial<ClinicPolicyConfig> | null;
  ai?: Partial<AIPolicyConfig> | null;
}): PolicyBundle {
  return {
    clinic: resolveClinicPolicy(opts?.clinic),
    ai: resolveAIPolicy(opts?.ai),
  };
}

/** Avalia Domain → Clinic → AI em sequência. */
export function evaluatePolicies(input: {
  eventType: string;
  currentPhase: CasePhase | null;
  actor: string;
  policies: PolicyBundle;
  overridePhase?: CasePhase;
}): DomainPolicyResult & { aiBlocked?: boolean } {
  if (input.actor === "ai" || input.actor.startsWith("ai:")) {
    if (!aiMayPublishEvent(input.policies.ai, input.eventType)) {
      return { allowed: false, aiBlocked: true, reason: "ai_policy_blocked" };
    }
  }

  const domain = evaluateDomainPolicy({
    eventType: input.eventType,
    currentPhase: input.currentPhase,
  });

  if (!domain.allowed) return domain;

  if (input.overridePhase) {
    return { ...domain, suggestedPhase: input.overridePhase };
  }

  if (
    domain.suggestPaymentRequested &&
    !input.policies.clinic.autoOpenFinanceAfterConsult
  ) {
    return {
      ...domain,
      suggestPaymentRequested: false,
      suggestedPhase: "pos",
    };
  }

  return domain;
}
