import type { LossConfidence } from "./types";

export type ObjectionInference = {
  motivoProvavel: string;
  confianca: LossConfidence;
  rationale: string;
};

const PRICE_PATTERNS = [/preço/i, /preco/i, /valor/i, /caro/i, /parcela/i, /convênio/i, /convenio/i];
const SCHEDULE_PATTERNS = [/horário/i, /horario/i, /vaga/i, /disponib/i, /agenda/i];
const LOCATION_PATTERNS = [/endereço/i, /endereco/i, /local/i, /distân/i, /longe/i];
const INDECISION_PATTERNS = [/vou ver/i, /vou pensar/i, /depois te falo/i, /preciso pensar/i];

export function inferObjectionFromConversation(messages: {
  role: "user" | "assistant" | "system";
  content: string;
}[]): ObjectionInference {
  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length === 0) {
    return {
      motivoProvavel: "nao_respondeu",
      confianca: "media",
      rationale: "Nenhuma mensagem do contato na conversa",
    };
  }

  const lastUser = userMessages[userMessages.length - 1]?.content ?? "";
  const lastFew = userMessages.slice(-3).map((m) => m.content).join(" ");

  for (const p of PRICE_PATTERNS) {
    if (p.test(lastFew)) {
      return { motivoProvavel: "preco", confianca: "alta", rationale: "Últimas mensagens mencionam preço/valor" };
    }
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")?.content ?? "";
  if (SCHEDULE_PATTERNS.some((p) => p.test(lastAssistant)) && lastUser.trim().length < 5) {
    return { motivoProvavel: "horario", confianca: "media", rationale: "Equipe ofereceu horários sem resposta substantiva" };
  }

  for (const p of LOCATION_PATTERNS) {
    if (p.test(lastFew)) {
      return { motivoProvavel: "distancia", confianca: "alta", rationale: "Mencionou localização/distância" };
    }
  }

  for (const p of INDECISION_PATTERNS) {
    if (p.test(lastFew)) {
      return { motivoProvavel: "indecisao", confianca: "alta", rationale: "Expressou indecisão" };
    }
  }

  if (lastUser.trim().length === 0) {
    return { motivoProvavel: "nao_respondeu", confianca: "baixa", rationale: "Silêncio após interação" };
  }

  return {
    motivoProvavel: "motivo_nao_identificado",
    confianca: "baixa",
    rationale: "Nenhum padrão claro identificado",
  };
}
