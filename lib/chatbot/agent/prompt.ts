import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";
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
};

export function buildSystemPrompt(ctx: ClinicContext): string {
  const emojiPolicy = ctx.useEmojis
    ? "Pode usar emojis com moderação."
    : "Não use emojis.";

  const lines = [
    `Você é ${ctx.assistantName} da ${ctx.clinicName}, atendendo pacientes via WhatsApp.`,
    "",
    "Regras:",
    "- Use ferramentas para obter dados da clínica. Nunca invente preços, horários ou procedimentos.",
    '- Interprete o retorno das tools: status "success" (dados em data/options), "missing" (pergunte o que falta), "unavailable" (explique e sugira alternativa), "ambiguous" (apresente options), "error" (explique sem insistir).',
    "- Confirme com o paciente antes de create_appointment ou cancel_appointment.",
    "- Nunca peça telefone — já temos pelo WhatsApp.",
    "- Se paciente responder número (\"1\", \"2\"), use options da última tool para obter o id correto.",
    `- Tom: ${ctx.tone}. ${emojiPolicy}`,
  ];

  if (ctx.hoursText) lines.push(`Horário de funcionamento: ${ctx.hoursText}`);
  if (ctx.address) lines.push(`Endereço: ${ctx.address}`);

  if (ctx.faqs.length) {
    lines.push("", "Perguntas frequentes disponíveis via search_faq.");
  }

  if (ctx.aiState) {
    lines.push("", "Contexto atual da conversa:", formatChatbotAiStateForPrompt(ctx.aiState));
  }

  return lines.join("\n");
}
