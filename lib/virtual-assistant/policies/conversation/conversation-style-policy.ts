/**
 * ConversationStylePolicy — how the assistant speaks (channel-agnostic).
 * No side effects: decide* returns ConversationStyleDecision.
 */

export type ResponseLength = "short" | "medium";
export type GreetingStyle = "resolve_intent" | "menu_if_greeting_only";

export type ConversationStylePolicy = {
  tone: "formal" | "informal";
  useEmojis: boolean;
  responseLength: ResponseLength;
  greetingStyle: GreetingStyle;
  maxQuestionsPerTurn: number;
  allowLists: boolean;
  /** Ban stock assistant phrases */
  antiSlop: boolean;
  /** Forbid echoing internal workflow/goal/tool status blocks */
  forbidInternalEcho: boolean;
};

export type ConversationStylePolicyInput = Partial<ConversationStylePolicy>;

export type ConversationStyleDecision = {
  instructions: string;
  maxQuestions: number;
  allowLists: boolean;
  greetingStyle: GreetingStyle;
  responseLength: ResponseLength;
};

export type ConversationStyleContext = {
  channel?: string;
};

export function getDefaultConversationStylePolicy(): ConversationStylePolicy {
  return {
    tone: "informal",
    useEmojis: true,
    responseLength: "short",
    greetingStyle: "menu_if_greeting_only",
    maxQuestionsPerTurn: 1,
    allowLists: true,
    antiSlop: true,
    forbidInternalEcho: true,
  };
}

export function mergeConversationStylePolicy(
  input?: ConversationStylePolicyInput | null
): ConversationStylePolicy {
  const base = getDefaultConversationStylePolicy();
  if (!input) return base;
  return {
    tone: input.tone ?? base.tone,
    useEmojis: input.useEmojis ?? base.useEmojis,
    responseLength: input.responseLength ?? base.responseLength,
    greetingStyle: input.greetingStyle ?? base.greetingStyle,
    maxQuestionsPerTurn: input.maxQuestionsPerTurn ?? base.maxQuestionsPerTurn,
    allowLists: input.allowLists ?? base.allowLists,
    antiSlop: input.antiSlop ?? base.antiSlop,
    forbidInternalEcho: input.forbidInternalEcho ?? base.forbidInternalEcho,
  };
}

function toneLabel(tone: ConversationStylePolicy["tone"]): string {
  return tone === "formal" ? "formal e respeitoso" : "casual e direto";
}

function toneGuidance(tone: ConversationStylePolicy["tone"]): string {
  if (tone === "formal") {
    return "Formal: tratamento respeitoso (senhor/senhora quando adequado), sem gírias.";
  }
  return 'Informal: use "você", tom leve — sem exagerar na cordialidade.';
}

function emojiRule(useEmojis: boolean): string {
  return useEmojis ? "Pode usar emojis com moderação." : "Não use emojis.";
}

function buildInstructions(policy: ConversationStylePolicy): string {
  const lengthHint =
    policy.responseLength === "short"
      ? "1–2 parágrafos na maioria dos casos."
      : "Respostas médias quando necessário; ainda assim sem enrolação.";

  const listHint = policy.allowLists
    ? "Listas numeradas só para menus de opções ou horários disponíveis."
    : "Evite listas; prefira frases curtas.";

  const greetingHint =
    policy.greetingStyle === "menu_if_greeting_only"
      ? "Na primeira resposta: resolva a intenção (agendar, preço, info). Menu numerado só se o paciente apenas cumprimentar."
      : "Na primeira resposta: resolva a intenção do paciente imediatamente.";

  const lines = [
    "# Estilo de resposta",
    "Você é uma profissional experiente da clínica. Resolva a dúvida do paciente de forma útil — não pareça um assistente de IA genérico.",
    "",
    `Tom configurado: ${toneLabel(policy.tone)}. ${emojiRule(policy.useEmojis)}`,
    `O tom define formalidade e calor humano — NÃO justifica respostas longas, genéricas ou frases de robô. ${toneGuidance(policy.tone)}`,
    "",
    "## Conversão e fluxo",
    `- ${greetingHint}`,
    `- No máximo ${policy.maxQuestionsPerTurn} pergunta(s) por turno; feche com um próximo passo claro.`,
    "",
    "## Regras obrigatórias",
    "- Responda apenas ao que foi perguntado. Não acrescente contexto desnecessário.",
    "- Seja específico. Evite respostas genéricas que poderiam servir para qualquer pergunta.",
  ];

  if (policy.antiSlop) {
    lines.push(
      '- Nunca use frases prontas: "Ótima pergunta.", "Claro!", "Com certeza.", "Vale lembrar que...", "É importante destacar que...", "Em resumo...", "Espero ter ajudado."',
      "- Não faça elogios ao paciente."
    );
  }

  lines.push(
    "- Não explique conceitos que o paciente claramente já demonstra conhecer.",
    "- Prefira exemplos concretos em vez de abstrações.",
    "- Quando existir resposta objetiva, forneça-a imediatamente.",
    "- Não escreva parágrafos apenas para fazer transições.",
    "- Evite repetir a pergunta antes de responder.",
    "- Se não souber, diga claramente — não invente."
  );

  if (policy.forbidInternalEcho) {
    lines.push(
      '- Nunca ecoe blocos internos ao paciente (ex.: "Workflow ativo", "Goals pendentes", status de tools, IDs técnicos).'
    );
  }

  lines.push(
    "",
    "## Formato",
    "- Frases curtas e linguagem natural. Cada frase deve acrescentar informação nova.",
    `- ${lengthHint} ${listHint}`,
    "- Elimine redundâncias. Evite listas quando um ou dois parágrafos bastam.",
    "- Não aumente o tamanho da resposta só para parecer mais completa.",
    "",
    "## Ordem da resposta",
    "1. Resposta direta.",
    "2. Motivo, se necessário.",
    "3. Próximos passos, somente quando forem úteis.",
    "",
    "## Antes de enviar",
    "Revise mentalmente: estou repetindo algo? Usando frase pronta? Existe forma mais específica? Respondo exatamente o que foi perguntado? Um profissional humano escreveria assim?"
  );

  return lines.join("\n");
}

export function decideConversationStyle(
  policy: ConversationStylePolicy,
  _ctx?: ConversationStyleContext
): ConversationStyleDecision {
  return {
    instructions: buildInstructions(policy),
    maxQuestions: policy.maxQuestionsPerTurn,
    allowLists: policy.allowLists,
    greetingStyle: policy.greetingStyle,
    responseLength: policy.responseLength,
  };
}

/** Adapter for LLM prompt consumers — projects Decision only. */
export function toPromptInstructions(decision: ConversationStyleDecision): string {
  return decision.instructions;
}
