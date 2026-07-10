import type { Intent } from "../domain/shared/intent";

const KEYWORD_INTENTS: Array<{ pattern: RegExp; intent: Intent }> = [
  { pattern: /agendar|marcar|consulta|horário|horario/i, intent: "booking" },
  { pattern: /preço|preco|valor|quanto custa|orcamento|orçamento/i, intent: "pricing" },
  { pattern: /dúvida|duvida|informação|informacao|endereço|endereco|horário de funcionamento/i, intent: "faq" },
  { pattern: /cadastr|interesse|contato|captação|captacao/i, intent: "crm" },
  { pattern: /atendente|humano|pessoa/i, intent: "handoff" },
];

const MENU_MAP: Record<string, Intent> = {
  "1": "booking",
  "2": "pricing",
  "3": "faq",
  "4": "crm",
  "5": "handoff",
};

const GREETING_PATTERNS = [
  /^(oi|olá|ola|hey|hi|hello|e\s*aí|e ai|bom dia|boa tarde|boa noite|salve|fala|opa|tudo bem|td bem)[\s!.?]*$/i,
];

export function isGreeting(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return GREETING_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function resolveIdleIntentFromKeywords(text: string): Intent | null {
  const trimmed = text.trim();
  if (MENU_MAP[trimmed]) return MENU_MAP[trimmed];

  for (const { pattern, intent } of KEYWORD_INTENTS) {
    if (pattern.test(trimmed)) return intent;
  }

  return null;
}

export function firstStepForIntent(intent: Intent): string | null {
  switch (intent) {
    case "booking":
      return "booking.collect_patient";
    case "pricing":
      return "pricing.collect_service";
    case "faq":
      return "faq.ask";
    case "crm":
      return "crm.collect_contact";
    case "handoff":
      return "handoff.pending";
    default:
      return null;
  }
}
