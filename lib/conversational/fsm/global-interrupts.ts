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
  if (!normalized) return null;

  if (
    /^(não|nao|n|no|cancelar|recuso|negativo|dispenso|recusar)$/i.test(normalized) ||
    /\b(não concordo|nao concordo|não autorizo|nao autorizo)\b/i.test(normalized)
  ) {
    return "no";
  }

  if (/^(sim|s|yes|confirmo|ok|pode)$/i.test(normalized)) return "yes";

  if (
    /\b(concordo|aceito|autorizo|pode sim|ok podemos|tem consentimento|dou consentimento|de acordo|estou de acordo)\b/i.test(
      normalized
    )
  ) {
    return "yes";
  }

  if (/^ok\b/.test(normalized) && /consentimento|concordo|aceito|autorizo|podemos/i.test(normalized)) {
    return "yes";
  }

  return null;
}
