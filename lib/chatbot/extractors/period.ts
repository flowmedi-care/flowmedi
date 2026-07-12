export function extractPeriod(text: string): "manha" | "tarde" | null {
  const t = text.toLowerCase();
  const hasManha = /manh[aã]/.test(t);
  const hasTarde = /\btarde\b/.test(t);
  // "manhã e tarde" = no period filter (all periods)
  if (hasManha && hasTarde) return null;
  if (hasManha) return "manha";
  if (hasTarde) return "tarde";
  return null;
}
