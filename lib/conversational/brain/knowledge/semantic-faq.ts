import type { ClinicConfig } from "../../clinic/clinic-config";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\W+/)
    .filter((t) => t.length > 2);
}

function scoreOverlap(queryTokens: string[], target: string): number {
  const targetTokens = new Set(tokenize(target));
  if (!queryTokens.length) return 0;
  let hits = 0;
  for (const t of queryTokens) {
    if (targetTokens.has(t)) hits += 1;
  }
  return hits / queryTokens.length;
}

/** FAQ retrieval: substring + token overlap (semantic embedding hook point). */
export function semanticFaqSearch(
  query: string,
  faqs: ClinicConfig["faqs"]
): { id: string; question: string; answer: string } | null {
  const lower = query.toLowerCase();
  const direct = faqs.find(
    (f) =>
      f.question.toLowerCase().includes(lower) || f.answer.toLowerCase().includes(lower)
  );
  if (direct) return direct;

  const tokens = tokenize(query);
  let best: (typeof faqs)[number] | null = null;
  let bestScore = 0;

  for (const faq of faqs) {
    const score = Math.max(
      scoreOverlap(tokens, faq.question),
      scoreOverlap(tokens, faq.answer) * 0.9
    );
    if (score > bestScore) {
      bestScore = score;
      best = faq;
    }
  }

  return bestScore >= 0.25 ? best : null;
}
