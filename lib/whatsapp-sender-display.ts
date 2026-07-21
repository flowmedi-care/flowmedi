import { DEFAULT_HANDOFF_TRANSFER_COPY } from "@/lib/virtual-assistant/policies/conversation/handoff-policy";

/** Patient-facing handoff copy — sourced from HandoffPolicy defaults. */
export const HANDOFF_REPLY_BODY = DEFAULT_HANDOFF_TRANSFER_COPY;

export type WhatsAppSenderType = "assistant" | "human" | "system" | "patient";

export function extractFirstName(fullName?: string | null): string {
  if (!fullName) return "";
  const normalized = fullName.trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  return normalized.split(" ")[0] || "";
}

/** Cabeçalho estilo template WhatsApp: *Nome* + corpo */
export function formatPatientVisibleMessage(senderName: string, body: string): string {
  const name = senderName.trim() || "Equipe";
  const text = body.trim();
  if (!text) return `*${name}*`;
  return `*${name}*\n\n${text}`;
}

export function resolveAssistantDisplayName(assistantName?: string | null): string {
  const trimmed = assistantName?.trim();
  return trimmed || "Assistente";
}

export function resolveHumanDisplayName(fullName?: string | null): string {
  const first = extractFirstName(fullName);
  return first || "Equipe";
}

export function resolveSystemDisplayName(clinicName?: string | null): string {
  const trimmed = clinicName?.trim();
  return trimmed || "Sistema";
}

/** Evita duplicar cabeçalho se o texto já começa com *Nome* */
export function ensurePatientVisibleMessage(senderName: string, body: string): string {
  const trimmed = body.trim();
  const headerPattern = /^\*[^*\n]+\*\s*(\n\n)?/;
  if (headerPattern.test(trimmed)) return trimmed;
  return formatPatientVisibleMessage(senderName, trimmed);
}
