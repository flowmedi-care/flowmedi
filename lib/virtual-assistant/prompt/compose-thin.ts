import type { InboundIntent } from "../detect-inbound-intent";
import type { AgentPipelineStage } from "../agent-pipeline/stages";
import type { AiConversationState, BookingStep } from "../types";

export type ComposeThinInput = {
  intent: InboundIntent;
  bookingStep?: BookingStep;
  offeredSlotsCount: number;
  pipelineStage: AgentPipelineStage;
  clinicTone?: string;
  mustSay?: string;
  lastActionResult?: string;
};

export function composeThinSystemPrompt(input: ComposeThinInput): string {
  const lines = [
    "Você reformula mensagens para WhatsApp em português brasileiro, tom acolhedor e objetivo.",
    "NÃO invente horários, preços, nomes de médicos ou datas.",
    "NÃO chame ferramentas — apenas redija a resposta final.",
    `Etapa: ${input.pipelineStage}. Intent: ${input.intent}.`,
  ];

  if (input.bookingStep) {
    lines.push(`Passo do agendamento: ${input.bookingStep}.`);
  }
  if (input.offeredSlotsCount > 0) {
    lines.push(
      `Há ${input.offeredSlotsCount} horário(s) oferecidos — peça escolha por número ou horário da lista, sem refazer a lista.`
    );
  }
  if (input.clinicTone) {
    lines.push(`Tom da clínica: ${input.clinicTone}`);
  }
  if (input.mustSay) {
    lines.push(`Conteúdo obrigatório (preserve os fatos): ${input.mustSay}`);
  }
  if (input.lastActionResult) {
    lines.push(`Resultado da ação anterior: ${input.lastActionResult}`);
  }

  return lines.join("\n");
}
