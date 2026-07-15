export function extractPeriod(text: string): "manha" | "tarde" | null {
  const t = text.toLowerCase();
  // Not \b: JS word boundaries treat "ã" as non-word, so "manhã" would never match.
  // Exclude "amanhã"/"amanha" via negative lookbehind on the leading "a".
  const hasManha = /(?<!a)manh[aã](?![a-záàâãéêíóôõú])/i.test(t);
  const hasTarde = /\btarde\b/.test(t);
  // "manhã e tarde" = no period filter (all periods)
  if (hasManha && hasTarde) return null;
  if (hasManha) return "manha";
  if (hasTarde) return "tarde";
  return null;
}
