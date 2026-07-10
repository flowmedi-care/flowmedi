import type { GlobalInterrupt } from "./resolved-input";

const CANCEL_PATTERNS = [
  /^cancelar$/i,
  /^sair$/i,
  /^menu$/i,
  /^voltar$/i,
  /^início$/i,
  /^inicio$/i,
];

const HANDOFF_PATTERNS = [
  /atendente/i,
  /humano/i,
  /pessoa/i,
  /falar com algu/i,
  /secretária/i,
  /secretaria/i,
];

export function detectGlobalInterrupt(text: string): GlobalInterrupt | null {
  const normalized = text.trim();
  if (!normalized) return null;

  for (const pattern of HANDOFF_PATTERNS) {
    if (pattern.test(normalized)) return { type: "handoff" };
  }

  for (const pattern of CANCEL_PATTERNS) {
    if (pattern.test(normalized)) return { type: "cancel" };
  }

  if (/^menu$/i.test(normalized)) return { type: "menu" };

  return null;
}

export function detectConfirmation(text: string): "yes" | "no" | null {
  const normalized = text.trim().toLowerCase();
  if (/^(sim|s|yes|confirmo|ok|pode)$/i.test(normalized)) return "yes";
  if (/^(não|nao|n|no|cancelar)$/i.test(normalized)) return "no";
  return null;
}
