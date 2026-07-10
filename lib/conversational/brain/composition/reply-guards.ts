const NOT_FOUND_PHRASE = "não encontrei essa informação agora";

export function applyReplyGuards(
  reply: string,
  previousReplies: string[],
  sentiment: "neutral" | "frustrated" | "positive"
): string {
  let text = reply.trim();

  if (text.toLowerCase().includes(NOT_FOUND_PHRASE)) {
    text =
      "Deixa eu tentar de outro jeito — posso listar nossos serviços ou ajudar com agendamento e valores. O que prefere?";
  }

  const normalized = normalize(text);
  if (previousReplies.some((p) => normalize(p) === normalized)) {
    if (sentiment === "frustrated") {
      return "Entendo sua frustração. Vou te ajudar por aqui — me diz qual serviço ou informação você precisa que eu busco agora.";
    }
    return "Percebi que minha resposta anterior não ajudou. Pode me dizer de outra forma o que você precisa?";
  }

  return text;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
