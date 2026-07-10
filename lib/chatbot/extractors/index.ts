import type { OfferedOption } from "../state/types";
import type { NormalizedFacts } from "./types";
import { extractDate } from "./date";
import { extractPeriod } from "./period";

export type { NormalizedFacts } from "./types";
export { extractDate, parseDateFromText, weekdayFromText } from "./date";
export { extractPeriod } from "./period";

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
export function extractFacts(text: string, refDate = new Date()): NormalizedFacts {
  const facts: NormalizedFacts = {};
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
  return facts;
}
