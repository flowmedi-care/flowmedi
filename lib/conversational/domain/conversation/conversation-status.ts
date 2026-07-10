export const CONVERSATION_STATUSES = [
  "open",
  "awaiting_consent",
  "in_flow",
  "handoff",
  "closed",
] as const;

export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export function isConversationStatus(value: string): value is ConversationStatus {
  return (CONVERSATION_STATUSES as readonly string[]).includes(value);
}
