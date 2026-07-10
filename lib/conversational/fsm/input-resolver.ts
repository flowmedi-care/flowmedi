import type { Conversation } from "../domain/conversation/conversation";
import type { ClinicConfig } from "../clinic/clinic-config";
import type { LanguageService } from "../language/language-service";
import { detectConfirmation, detectGlobalInterrupt } from "./global-interrupts";
import { isGreeting, resolveIdleIntentFromKeywords } from "./idle-entry";
import type { ResolvedInput } from "./resolved-input";
import { emptyResolvedInput } from "./resolved-input";
import { conversationToFsmState } from "../application/domain-fsm-mapper";

export type InputResolverDeps = {
  language: LanguageService;
};

export class InputResolver {
  constructor(private readonly deps: InputResolverDeps) {}

  async resolve(
    conversation: Conversation,
    text: string,
    config: ClinicConfig
  ): Promise<ResolvedInput> {
    const trimmed = text.trim();
    const base = emptyResolvedInput(trimmed);
    const fsmState = conversationToFsmState(conversation);

    const interrupt = detectGlobalInterrupt(trimmed);
    if (interrupt) {
      return { ...base, interrupt };
    }

    if (fsmState === "consent.pending") {
      const confirmation = detectConfirmation(trimmed);
      return { ...base, confirmation };
    }

    if (fsmState === "idle") {
      if (isGreeting(trimmed)) {
        return { ...base, intent: null };
      }

      let intent = resolveIdleIntentFromKeywords(trimmed);
      if (!intent && trimmed && !config.llmDisabled) {
        const extracted = await this.deps.language.extract({
          text: trimmed,
          allowedIntents: ["booking", "pricing", "faq", "discovery", "crm", "handoff", "unknown"],
        });
        if (extracted.intent !== "unknown") {
          intent = extracted.intent;
        }
      }
      return { ...base, intent };
    }

    return base;
  }
}
