import type { AiState } from "../state/types";

const BOOKING_START =
  /\b(quero\s+agendar|agendar(\s+(uma\s+)?consulta)?|marcar(\s+(uma\s+)?consulta)?|nova\s+consulta|quero\s+marcar|agenda[r]?)\b/i;

const NEW_CHOICE =
  /\b(nova|novo|marcar\s+nova|agendar\s+nova|quero\s+nova|mesmo\s+assim|outra\s+consulta)\b/i;

const ALTER_CHOICE =
  /\b(alterar|altera|remarcar|remarca|mudar|trocar|existente|j[aá]\s+tenho|a\s+que\s+j[aá])\b/i;

export const BOOKING_FORK_PROMPT =
  "Vi que você já possui consultas futuras. Deseja marcar uma nova mesmo assim, ou pretende alterar alguma existente?";

export function isBookingStartIntent(userText: string): boolean {
  return BOOKING_START.test(userText.trim());
}

export function resolveBookingForkChoice(
  userText: string
): "new" | "alter" | null {
  const t = userText.trim();
  if (!t) return null;
  const wantsNew = NEW_CHOICE.test(t);
  const wantsAlter = ALTER_CHOICE.test(t);
  if (wantsNew && !wantsAlter) return "new";
  if (wantsAlter && !wantsNew) return "alter";
  // "nova" alone / "alterar" alone already covered; prefer alter when explicit remarcação
  if (/\b(remarcar|alterar)\b/i.test(t)) return "alter";
  if (/\bnova\b/i.test(t)) return "new";
  return null;
}

/**
 * Offer soft fork when starting consulta with upcoming appointments and no booking progress.
 */
export function shouldOfferBookingFork(
  aiState: AiState,
  upcomingCount: number,
  userText: string
): boolean {
  if (upcomingCount <= 0) return false;
  const fork = aiState.booking_fork?.status;
  if (fork === "new" || fork === "alter" || fork === "awaiting_choice") {
    return false;
  }
  const booking = aiState.booking;
  if (booking?.doctor_id || booking?.procedure_id) return false;
  if (booking?.date || booking?.pending_slot) return false;
  if (booking?.status === "confirming" || booking?.status === "done") return false;
  return isBookingStartIntent(userText);
}

export function shouldResolveBookingFork(
  aiState: AiState,
  userText: string
): "new" | "alter" | "reprompt" | null {
  if (aiState.booking_fork?.status !== "awaiting_choice") return null;
  const choice = resolveBookingForkChoice(userText);
  if (choice) return choice;
  return "reprompt";
}
