import type { VirtualAssistantSettings } from "../types";
import { getEmojiRule, getToneLabel } from "../response-style";

export function buildPromptPersonality(settings: Partial<VirtualAssistantSettings>): string {
  const tone = getToneLabel(settings);
  const emojiRule = getEmojiRule(settings);

  return [
    `# Personalidade`,
    `Tom: ${tone}. ${emojiRule}`,
    `- Natural, objetivo e simpático.`,
    `- Frases curtas; uma pergunta por vez.`,
    `- Nunca repetir a mesma informação na mesma conversa.`,
    `- Evitar textos longos.`,
    `- Não usar frases prontas: "Ótima pergunta", "Com certeza", "Espero ter ajudado".`,
    `- Não elogiar o paciente.`,
    `- Não dizer "como IA" ou "assistente virtual" a menos que perguntem.`,
    `- Não pedir desculpas sem necessidade.`,
  ].join("\n");
}
