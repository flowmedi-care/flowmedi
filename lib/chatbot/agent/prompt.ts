import type { VirtualAssistantSettings } from "@/lib/virtual-assistant/types";
import type { FaqItem } from "../tools/types";

export type ClinicContext = {
  clinicName: string;
  assistantName: string;
  tone: string;
  useEmojis: boolean;
  hoursText?: string;
  address?: string;
  faqs: FaqItem[];
  settings: Partial<VirtualAssistantSettings>;
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
    '- Se uma ferramenta retornar status "missing", pergunte ao paciente as informações faltantes de forma natural.',
    '- Se retornar "validation_error" ou "domain_error", explique o problema sem insistir na mesma ação.',
    "- Confirme com o paciente antes de criar ou cancelar agendamentos.",
    `- Tom: ${ctx.tone}. ${emojiPolicy}`,
  ];

  if (ctx.hoursText) lines.push(`Horário de funcionamento: ${ctx.hoursText}`);
  if (ctx.address) lines.push(`Endereço: ${ctx.address}`);

  if (ctx.faqs.length) {
    lines.push("", "Perguntas frequentes disponíveis via search_faq.");
  }

  return lines.join("\n");
}
