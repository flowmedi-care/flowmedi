import type { OperationalMemory } from "../types/memory";

const MENU_OPTIONS = [
  "Agendar consulta",
  "Preços",
  "Dúvidas",
  "Deixar contato",
  "Falar com atendente",
];

export function resolveMenuReference(
  text: string,
  memory: OperationalMemory
): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  const num = Number(trimmed);
  if (num < 1 || num > 5) return null;
  if (!memory.lastMenuShown) return num;
  return num;
}

export function menuGoalFromReference(ref: number): string {
  switch (ref) {
    case 1:
      return "book";
    case 2:
      return "price";
    case 3:
      return "clarify";
    case 4:
      return "crm";
    case 5:
      return "handoff";
    default:
      return "inform";
  }
}

export function defaultMenuShown(): OperationalMemory["lastMenuShown"] {
  return { options: MENU_OPTIONS, at: new Date().toISOString() };
}
