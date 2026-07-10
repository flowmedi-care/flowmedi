import type { Conversation } from "../domain/conversation/conversation";
import { requiresConsent } from "../domain/services/consent-policy";
import type { Intent } from "../domain/shared/intent";
import { conversationToFsmState, fsmStateToConversationPatch } from "../application/domain-fsm-mapper";
import type { ClinicConfig } from "../clinic/clinic-config";
import {
  consentPendingReply,
  nextStateAfterOutcome,
  nextStateAfterReceive,
} from "./transitions";
import type { FsmTransition, HandlerOutcome, SideEffect } from "./side-effects";
import type { ResolvedInput } from "./resolved-input";
import type { FsmState } from "./states";
import { assertFsmState } from "../application/domain-fsm-mapper";

export class FsmEngine {
  afterReceive(
    conversation: Conversation,
    input: ResolvedInput,
    config: ClinicConfig,
    options?: { deferConsent?: boolean; pendingIntent?: Intent | null }
  ): FsmTransition {
    const current = conversationToFsmState(conversation);
    const effects: SideEffect[] = [];

    let next = nextStateAfterReceive(current, input) as FsmState;

    if (current === "consent.pending") {
      if (input.confirmation === "yes") {
        conversation.grantConsent();
        effects.push({
          type: "recordConsent",
          patientId: conversation.patientRef?.id ?? null,
          clinicId: conversation.clinicId,
          conversationId: conversation.id,
        });
        const deferred = conversation.consumeDeferredIntent();
        if (deferred) {
          const step = nextStateAfterReceive("idle", { ...input, intent: deferred, interrupt: null });
          next = assertFsmState(step);
        } else {
          next = "idle";
        }
      } else if (input.confirmation === "no") {
        conversation.denyConsent();
        next = "idle";
      } else {
        const pending = consentPendingReply();
        return {
          fsmState: current,
          effects,
          skipHandler: pending.skipHandler,
          reply: pending.reply,
        };
      }
    } else if (current === "idle" && input.intent && !input.interrupt) {
      const needsConsent = requiresConsent({
        intent: input.intent,
        channel: conversation.channel,
        consent: conversation.consent,
        requiresConsentForMessaging: config.requiresConsentForMessaging,
      });
      if (needsConsent) {
        conversation.requestConsent(input.intent);
        next = "consent.pending";
        const pending = consentPendingReply();
        return {
          fsmState: next,
          effects,
          skipHandler: pending.skipHandler,
          reply: pending.reply,
        };
      }
    }

    if (input.interrupt?.type === "handoff") {
      conversation.enterHandoff(`ticket-${conversation.id}-${Date.now()}`);
      next = "handoff.pending";
    } else if (input.interrupt?.type === "cancel" || input.interrupt?.type === "menu") {
      conversation.abortFlow();
      next = "idle";
    } else if (next !== current) {
      fsmStateToConversationPatch(conversation, next);
    }

    return { fsmState: next, effects };
  }

  afterOutcome(
    conversation: Conversation,
    outcome: HandlerOutcome,
    _config: ClinicConfig
  ): FsmTransition {
    const current = conversationToFsmState(conversation);
    const effects: SideEffect[] = [];

    if (outcome.type === "complete") {
      conversation.completeFlow();
    } else if (outcome.type === "advance") {
      const next = nextStateAfterOutcome(current, "advance");
      if (next === "idle") {
        conversation.completeFlow();
      } else {
        fsmStateToConversationPatch(conversation, next);
      }
    } else if (outcome.type === "fail" && !outcome.recoverable) {
      conversation.abortFlow();
    }

    const fsmState = conversationToFsmState(conversation);
    return { fsmState, effects, reply: outcome.reply };
  }
}

export const fsmEngine = new FsmEngine();
