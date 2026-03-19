export const EDIT_WINDOW_MS = 5 * 60 * 1000;
export const MAX_SUGGESTION_LENGTH = 1500;
export const SPAM_COOLDOWN_MS = 4000;

export type PublicSuggestionRow = {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  edit_token: string;
};

export type PublicSuggestionPublic = {
  id: string;
  content: string;
  created_at: string;
};

export function sanitizeSuggestionContent(raw: string) {
  return raw.trim().replace(/\s{3,}/g, "  ");
}

export function isEditWindowOpen(createdAt: string, now = Date.now()) {
  const createdAtMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdAtMs)) return false;
  return now - createdAtMs <= EDIT_WINDOW_MS;
}

export function getEditWindowRemainingMs(createdAt: string, now = Date.now()) {
  const createdAtMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdAtMs)) return 0;
  return Math.max(0, EDIT_WINDOW_MS - (now - createdAtMs));
}

export function toPublicSuggestion(row: PublicSuggestionRow): PublicSuggestionPublic {
  return {
    id: row.id,
    content: row.content,
    created_at: row.created_at,
  };
}
