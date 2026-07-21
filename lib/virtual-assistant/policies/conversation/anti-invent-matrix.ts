/**
 * Anti-invent matrix — what the assistant may infer / ask / never invent.
 * Used in Conversation Style instructions and tests.
 */

export type AntiInventRow = {
  topic: string;
  canInfer: boolean;
  canAsk: boolean;
  canInvent: false;
  inferNote?: string;
};

/** Documentation + prompt source of truth. */
export const ANTI_INVENT_MATRIX: AntiInventRow[] = [
  { topic: "Preço", canInfer: false, canAsk: true, canInvent: false },
  { topic: "Convênio", canInfer: false, canAsk: true, canInvent: false },
  { topic: "Horário / slot", canInfer: false, canAsk: true, canInvent: false },
  { topic: "Regras / políticas da clínica", canInfer: false, canAsk: true, canInvent: false },
  {
    topic: "Motivos (complexidade, experiência, materiais, etc.)",
    canInfer: false,
    canAsk: true,
    canInvent: false,
    inferNote: "Só se vier de FAQ/tool",
  },
  {
    topic: "Procedimento / serviço",
    canInfer: true,
    canAsk: true,
    canInvent: false,
    inferNote: "Só se KB/tool",
  },
  {
    topic: "Horário de funcionamento",
    canInfer: true,
    canAsk: false,
    canInvent: false,
    inferNote: "KB/settings",
  },
  {
    topic: "Nome da clínica",
    canInfer: true,
    canAsk: true,
    canInvent: false,
    inferNote: "Só clinics.name; nickname → confirmar oficial",
  },
];

export function buildAntiInventPromptBlock(): string {
  const lines = [
    "## Anti-inventar (obrigatório)",
    "Nunca invente: preço, convênio, horários, regras da clínica, políticas ou motivos (ex.: complexidade, experiência do profissional, materiais).",
    "Só responda fatos que vieram de: base de conhecimento, procedimentos/serviços, FAQ (search_faq), tools ou policies.",
    "Se não houver fonte: diga que não tem o detalhe e pergunte o que falta, tente alternativa, ou ofereça atendente no WhatsApp — nunca telefone/e-mail nem “consulte a clínica” (o paciente já está no WhatsApp da clínica).",
    "Uma pergunta por vez na abertura de agendamento (procedimento ou médico — não os dois).",
  ];
  return lines.join("\n");
}
