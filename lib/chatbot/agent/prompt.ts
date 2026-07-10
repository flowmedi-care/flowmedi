import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";
import type { NormalizedFacts } from "../extractors/types";
import type { FaqItem } from "../tools/types";
import type { AiState } from "../state/types";
import { formatChatbotAiStateForPrompt } from "../state/format-for-prompt";

export type ClinicContext = {
  clinicName: string;
  assistantName: string;
  tone: string;
  useEmojis: boolean;
  hoursText?: string;
  address?: string;
  faqs: FaqItem[];
  settings: Partial<VirtualAssistantSettings>;
  aiState?: AiState;
  facts?: NormalizedFacts;
};

export function formatContextForPrompt(
  facts: NormalizedFacts | undefined,
  aiState: AiState | undefined
): string {
  const lines: string[] = [];
  if (facts && Object.keys(facts).length > 0) {
    lines.push("Fatos extraídos da mensagem atual (determinísticos):");
    if (facts.date) lines.push(`- Data mencionada: ${facts.date}`);
    if (facts.period) lines.push(`- Turno mencionado: ${facts.period}`);
    if (facts.selectedIndex != null) {
      lines.push(`- Seleção numérica: ${facts.selectedIndex} (use offered_* ou options para obter id)`);
    }
    if (facts.confirmed === true) lines.push("- Paciente confirmou (sim/isso)");
    if (facts.confirmed === false) lines.push("- Paciente negou");
    if (facts.ordinal != null) {
      lines.push(`- Ordinal/primeiro: ${facts.ordinal} (ex: "qualquer um" → escolha opção ${facts.ordinal})`);
    }
  }
  if (aiState) {
    const stateBlock = formatChatbotAiStateForPrompt(aiState);
    if (stateBlock) {
      lines.push("", "Contexto da conversa:", stateBlock);
    }
  }
  return lines.join("\n");
}

export function buildSystemPrompt(ctx: ClinicContext): string {
  const emojiPolicy = ctx.useEmojis
    ? "Pode usar emojis com moderação."
    : "Não use emojis.";

  const lines = [
    `Você é ${ctx.assistantName} da ${ctx.clinicName}, atendendo pacientes via WhatsApp.`,
    "",
    "Regras:",
    "- Use ferramentas para obter dados da clínica. Nunca invente preços, horários ou procedimentos.",
    '- Interprete retornos: "success" (dados), "needs_input" (pergunte o que falta ou apresente options), "unavailable" (explique e sugira alternativa), "not_found" (entidade não existe), "error" (explique sem insistir).',
    "- Confirme com o paciente antes de create_appointment ou cancel_appointment.",
    "- Nunca peça telefone — já temos pelo WhatsApp.",
    "- Se paciente responder número (\"1\", \"2\"), use options da última tool ou offered_* para o id correto.",
    "- \"Marca qualquer um\" → escolha a primeira opção disponível e continue; NÃO transfira para humano.",
    `- Tom: ${ctx.tone}. ${emojiPolicy}`,
  ];

  if (ctx.hoursText) lines.push(`Horário de funcionamento: ${ctx.hoursText}`);
  if (ctx.address) lines.push(`Endereço: ${ctx.address}`);

  if (ctx.faqs.length) {
    lines.push("", "Perguntas frequentes disponíveis via search_faq.");
  }

  const contextBlock = formatContextForPrompt(ctx.facts, ctx.aiState);
  if (contextBlock) {
    lines.push("", contextBlock);
  }

  return lines.join("\n");
}
