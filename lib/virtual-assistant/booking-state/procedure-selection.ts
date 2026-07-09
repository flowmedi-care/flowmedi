import type { OfferedProcedure } from "../types";

export function matchOfferedProcedure(
  text: string,
  offered: OfferedProcedure[]
): OfferedProcedure | null {
  const t = text.trim();
  if (!t || offered.length === 0) return null;

  const numMatch = t.match(/^\s*(\d{1,2})\s*$/);
  if (numMatch) {
    const idx = parseInt(numMatch[1]!, 10) - 1;
    if (idx >= 0 && idx < offered.length) return offered[idx]!;
    return null;
  }

  const lower = t.toLowerCase();
  const exact = offered.find((p) => p.name.toLowerCase() === lower);
  if (exact) return exact;

  const prefix = offered.filter((p) => p.name.toLowerCase().startsWith(lower));
  if (prefix.length === 1) return prefix[0]!;

  const contains = offered.filter((p) => p.name.toLowerCase().includes(lower));
  if (contains.length === 1) return contains[0]!;

  return null;
}

export function buildInvalidProcedureSelectionReply(
  text: string,
  offered: OfferedProcedure[]
): string {
  const list = offered.slice(0, 10).map((p, i) => `${i + 1}. ${p.name}`).join("\n");
  const numMatch = text.trim().match(/^\s*(\d{1,2})\s*$/);
  if (numMatch) {
    const n = parseInt(numMatch[1]!, 10);
    return `A opção ${n} não está na lista. Escolha um número de 1 a ${offered.length}:\n\n${list}`;
  }
  return `Não encontrei "${text.trim()}" na lista. Responda com o número ou o nome do procedimento:\n\n${list}`;
}

export function isProcedureSelectionMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/^\s*\d{1,2}\s*$/.test(t)) return true;
  if (t.length >= 3 && t.length <= 80 && !/\?/.test(t)) return true;
  return false;
}
