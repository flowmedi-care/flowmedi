/**
 * Thin adapter over ConversationStylePolicy for legacy imports.
 * Prefer decideConversationStyle / toPromptInstructions from policies/conversation.
 */
import type { VirtualAssistantSettings } from "./types";
import {
  decideConversationStyle,
  mergeConversationStylePolicy,
  toPromptInstructions,
  type ConversationStylePolicy,
} from "./policies/conversation/conversation-style-policy";

function policyFromSettings(
  settings: Partial<VirtualAssistantSettings>
): ConversationStylePolicy {
  return mergeConversationStylePolicy({
    tone: settings.tone === "formal" ? "formal" : "informal",
    useEmojis: settings.use_emojis !== false,
  });
}

function getToneLabel(settings: Partial<VirtualAssistantSettings>): string {
  return settings.tone === "formal" ? "formal e respeitoso" : "casual e direto";
}

function getEmojiRule(settings: Partial<VirtualAssistantSettings>): string {
  return settings.use_emojis !== false
    ? "Pode usar emojis com moderação."
    : "Não use emojis.";
}

/** @deprecated Use decideConversationStyle + toPromptInstructions */
export function buildResponseStyleBlock(
  settings: Partial<VirtualAssistantSettings>
): string {
  const decision = decideConversationStyle(policyFromSettings(settings));
  return toPromptInstructions(decision);
}

export { getToneLabel, getEmojiRule };
