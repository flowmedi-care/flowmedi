export const BOOKING_WEEKDAY_PATTERNS: { pattern: RegExp; dayIndex: number }[] = [
  { pattern: /\bdomingo\b|\bdom\.?\b/i, dayIndex: 0 },
  { pattern: /\bsegunda\b|\bseg\.?\b/i, dayIndex: 1 },
  { pattern: /\bter[cç]a\b|\bter\.?\b/i, dayIndex: 2 },
  { pattern: /\bquarta\b|\bqua\.?\b/i, dayIndex: 3 },
  { pattern: /\bquinta\b|\bqui\.?\b/i, dayIndex: 4 },
  { pattern: /\bsexta\b|\bsex\.?\b/i, dayIndex: 5 },
  { pattern: /\bs[aá]bado\b|\bsab\.?\b/i, dayIndex: 6 },
];

export function isSlotSelectionMessage(text: string): boolean {
  const t = text.toLowerCase();
  if (BOOKING_WEEKDAY_PATTERNS.some((w) => w.pattern.test(t))) return true;
  if (/\bmanh[aã]\b|\btarde\b|\bqualquer\s+hor[aá]rio\b/.test(t)) return true;
  if (/\b(\d{1,2})\/(\d{1,2})\b/.test(t)) return true;
  if (/\bpode ser\b|\bprefiro\b|\bquero\b.*\b(sexta|segunda|ter[cç]a|quarta|quinta|s[aá]bado)\b/.test(t)) {
    return true;
  }
  if (/^\s*\d{1,2}\s*$/.test(t)) return true;
  if (/\b\d{1,2}[:\s]?\d{0,2}\b/.test(t)) return true;
  return false;
}
