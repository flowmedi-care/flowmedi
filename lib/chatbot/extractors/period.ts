export function extractPeriod(text: string): "manha" | "tarde" | null {
  const t = text.toLowerCase();
  if (/manh[aã]/.test(t)) return "manha";
  if (/\btarde\b/.test(t)) return "tarde";
  return null;
}
