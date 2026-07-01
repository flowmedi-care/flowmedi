import type { SupabaseClient } from "@supabase/supabase-js";
import type { JourneyStepCode } from "@/lib/contact-journey/types";
import { sendAssistantOrTemplate } from "./send-assistant-or-template";

export type CommercialFollowupJourneyStep =
  | "qualificacao"
  | "aguardando_retorno"
  | "negociacao"
  | "objecao_identificada"
  | "orcamento_enviado"
  | "pagamento_sinal_pendente"
  | "cadastro_pendente";

const JOURNEY_STEP_TO_EVENT: Record<CommercialFollowupJourneyStep, string> = {
  qualificacao: "lead_reengagement",
  aguardando_retorno: "lead_reengagement",
  cadastro_pendente: "lead_reengagement",
  negociacao: "negotiation_followup",
  objecao_identificada: "negotiation_followup",
  orcamento_enviado: "quote_sent",
  pagamento_sinal_pendente: "negotiation_followup",
};

const DEFAULT_FALLBACK: Record<CommercialFollowupJourneyStep, string> = {
  qualificacao:
    "Olá! Estamos à disposição para continuar seu atendimento. Posso ajudar com alguma dúvida?",
  aguardando_retorno:
    "Olá! Passando para saber se ainda posso ajudar. Quando puder, responda esta mensagem.",
  cadastro_pendente:
    "Olá! Para concluir seu cadastro e agendar, basta responder aqui que eu continuo.",
  negociacao:
    "Olá! Ficou alguma dúvida sobre valores ou condições? Estou à disposição.",
  objecao_identificada:
    "Olá! Posso esclarecer qualquer dúvida sobre o atendimento ou valores.",
  orcamento_enviado:
    "Olá! Seu orçamento foi enviado. Posso ajudar com alguma dúvida?",
  pagamento_sinal_pendente:
    "Olá! Passando para lembrar do pagamento do sinal. Posso ajudar com algo?",
};

export function resolveCommercialFollowupEvent(journeyStep: JourneyStepCode): string | null {
  return (JOURNEY_STEP_TO_EVENT as Partial<Record<JourneyStepCode, string>>)[journeyStep] ?? null;
}

export function isCommercialFollowupStep(
  step: JourneyStepCode
): step is CommercialFollowupJourneyStep {
  return step in JOURNEY_STEP_TO_EVENT;
}

/**
 * Envia follow-up comercial/reengajamento respeitando janela de 24h.
 * Usa templates Meta quando o ticket está fechado.
 */
export async function sendCommercialFollowup(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    conversationId: string;
    phoneNumber: string;
    patientId: string;
    journeyStep: CommercialFollowupJourneyStep;
    fallbackText?: string;
    appointmentId?: string | null;
  }
): Promise<{ success: boolean; mode?: "free_text" | "template" | "flow"; error?: string }> {
  const eventCode = JOURNEY_STEP_TO_EVENT[opts.journeyStep];
  const fallbackText = opts.fallbackText ?? DEFAULT_FALLBACK[opts.journeyStep];

  const result = await sendAssistantOrTemplate(supabase, {
    clinicId: opts.clinicId,
    conversationId: opts.conversationId,
    phoneNumber: opts.phoneNumber,
    patientId: opts.patientId,
    appointmentId: opts.appointmentId ?? null,
    eventCode,
    fallbackText,
    eventMetadata: { journey_step: opts.journeyStep },
  });

  return {
    success: result.success,
    mode: result.mode,
    error: result.error,
  };
}

/**
 * Follow-up para agendamento abandonado no chat (pending_slot / pending_step).
 */
export async function sendBookingAbandonedFollowup(
  supabase: SupabaseClient,
  opts: {
    clinicId: string;
    conversationId: string;
    phoneNumber: string;
    patientId: string;
    fallbackText?: string;
  }
): Promise<{ success: boolean; mode?: "free_text" | "template" | "flow"; error?: string }> {
  const fallbackText =
    opts.fallbackText ??
    "Olá! Notamos que você estava agendando uma consulta. Posso ajudar a concluir?";

  const result = await sendAssistantOrTemplate(supabase, {
    clinicId: opts.clinicId,
    conversationId: opts.conversationId,
    phoneNumber: opts.phoneNumber,
    patientId: opts.patientId,
    eventCode: "booking_abandoned_followup",
    fallbackText,
    eventMetadata: { source: "booking_abandoned" },
  });

  return {
    success: result.success,
    mode: result.mode,
    error: result.error,
  };
}
