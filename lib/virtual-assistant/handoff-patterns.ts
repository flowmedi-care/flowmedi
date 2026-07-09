const HANDOFF_PATTERNS = [
  /falar com (um(a)? )?(atendente|humano|pessoa)/i,
  /quero (um )?atendente/i,
  /quero falar com (algu[eé]m|uma pessoa)/i,
  /\batendente humano\b/i,
  /reclama[çc][aã]o/,
];

export function shouldAutoHandoff(text: string): boolean {
  return HANDOFF_PATTERNS.some((p) => p.test(text));
}
