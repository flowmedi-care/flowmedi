import type { OfferedOption } from "../state/types";
import type { NormalizedFacts } from "./types";
import { extractDate, hasDateIntent } from "./date";
import { extractPeriod } from "./period";
import { attemptTimeChoice } from "./time";
import { extractCpfFromText } from "@/lib/virtual-assistant/normalize-cpf";
import type { OfferedSlot } from "../state/types";

export type { NormalizedFacts } from "./types";
export {
  extractDate,
  parseDateFromText,
  weekdayFromText,
  relativeDateFromText,
  hasDateIntent,
} from "./date";
export { extractPeriod } from "./period";
export {
  extractTimeChoice,
  attemptTimeChoice,
  extractClockPeriodIntent,
  resolveLocalMinutes,
} from "./time";

export function extractIndex(text: string): number | null {
  const m = text.trim().match(/^(\d{1,2})$/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 99 ? n : null;
}

export function extractBoolean(text: string): boolean | null {
  const t = text.trim().toLowerCase();
  if (/^(sim|s|isso|confirmo|pode marcar|ok|certo|exato)$/.test(t)) return true;
  if (/^(n[aã]o|nao|negativo|cancela)$/.test(t)) return false;
  return null;
}

export function extractOrdinal(text: string): number | null {
  const t = text.toLowerCase();
  if (/\b(primeir[oa]|qualquer\s+um[oa]?|tanto\s+faz|marca\s+qualquer)\b/.test(t)) return 1;
  if (/\bsegund[oa]\b/.test(t)) return 2;
  if (/\bterceir[oa]\b/.test(t)) return 3;
  return null;
}

export function extractEntityReference(
  text: string,
  options: OfferedOption[]
): string | null {
  if (!options.length) return null;
  const t = text.trim().toLowerCase();
  for (const opt of options) {
    const name = opt.name.toLowerCase();
    if (t.includes(name) || name.includes(t)) return opt.id;
  }
  return null;
}

/** Pure extraction — no state, no prompt, no side effects. */
export function extractFacts(
  text: string,
  refDate = new Date(),
  offeredSlots?: OfferedSlot[]
): NormalizedFacts & Record<string, unknown> {
  const facts: NormalizedFacts & Record<string, unknown> = {};
  const date = extractDate(text, refDate);
  if (date) facts.date = date;
  const period = extractPeriod(text);
  if (period) facts.period = period;
  const index = extractIndex(text);
  if (index != null) facts.selectedIndex = index;
  const confirmed = extractBoolean(text);
  if (confirmed != null) facts.confirmed = confirmed;
  const ordinal = extractOrdinal(text);
  if (ordinal != null) facts.ordinal = ordinal;

  const cpf = extractCpfFromText(text);
  if (cpf) facts.cpf = cpf;

  const emailMatch = text.match(
    /\b(?:e-?mail|email)\s*[:\-]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/i
  );
  if (emailMatch?.[1]) facts.email = emailMatch[1].toLowerCase();

  // Bare integer = selectedIndex only (reference-resolution contract).
  // Clock forms: 2-step extract → resolve local → match display / clinic-local.
  // Date-intent messages must not set time_unmatched against a stale day list.
  if (index == null) {
    const dateIntent = Boolean(date) || hasDateIntent(text);
    const attempt = attemptTimeChoice(text, offeredSlots, {
      periodFromFacts: period ?? null,
    });
    if (attempt.ok) {
      facts.selected_hour = attempt.pick.selected_hour;
      // Date-intent: keep hour label for UX; do not bind pending_slot to the old day's ISO.
      if (!dateIntent) {
        facts.selected_scheduled_at = attempt.pick.scheduled_at;
      }
    } else if (attempt.reason === "no_match" && !dateIntent) {
      facts.time_unmatched = true;
      if (attempt.resolvedHour) facts.unresolved_hour = attempt.resolvedHour;
    }
  }

  return facts;
}
