export const INTENTS = [
  "booking",
  "pricing",
  "faq",
  "crm",
  "handoff",
  "cancel",
  "unknown",
] as const;

export type Intent = (typeof INTENTS)[number];

export function isIntent(value: string): value is Intent {
  return (INTENTS as readonly string[]).includes(value);
}
