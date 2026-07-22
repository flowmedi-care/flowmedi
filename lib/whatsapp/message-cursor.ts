/**
 * Cursor composto para paginação de mensagens WhatsApp: sent_at|id
 */

export type MessageCursor = {
  sentAt: string;
  id: string;
};

export function encodeMessageCursor(sentAt: string, id: string): string {
  return `${sentAt}|${id}`;
}

export function parseMessageCursor(raw: string | null | undefined): MessageCursor | null {
  if (!raw || typeof raw !== "string") return null;
  const sep = raw.indexOf("|");
  if (sep <= 0 || sep === raw.length - 1) return null;
  const sentAt = raw.slice(0, sep).trim();
  const id = raw.slice(sep + 1).trim();
  if (!sentAt || !id) return null;
  if (Number.isNaN(Date.parse(sentAt))) return null;
  return { sentAt, id };
}

export function clampMessagesLimit(raw: string | null, fallback = 50, max = 100): number {
  const n = raw ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}
