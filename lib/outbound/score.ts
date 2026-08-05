export type ScoreAction =
  | "landing_opened"
  | "scroll_50"
  | "scroll_75"
  | "demo_viewed"
  | "faq"
  | "whatsapp_clicked";

export const SCORE_POINTS: Record<ScoreAction, number> = {
  landing_opened: 5,
  scroll_50: 5,
  scroll_75: 10,
  demo_viewed: 15,
  faq: 10,
  whatsapp_clicked: 40,
};

const SCORED_KEY = "fm_outbound_scored_actions";

export function readScoredActions(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SCORED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeScoredActions(actions: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SCORED_KEY, JSON.stringify([...actions]));
  } catch {
    // ignore
  }
}

const SCORE_KEY = "fm_outbound_lead_score";

export function readLeadScore(): number {
  if (typeof window === "undefined") return 0;
  try {
    const n = Number(sessionStorage.getItem(SCORE_KEY) || "0");
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeLeadScore(score: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SCORE_KEY, String(score));
  } catch {
    // ignore
  }
}

/**
 * Soma pontos uma vez por ação na sessão. Retorna novo score ou null se já pontuou.
 */
export function applyScoreAction(action: ScoreAction): number | null {
  const scored = readScoredActions();
  if (scored.has(action)) return null;
  scored.add(action);
  writeScoredActions(scored);
  const next = readLeadScore() + SCORE_POINTS[action];
  writeLeadScore(next);
  return next;
}
