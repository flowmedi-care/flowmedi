import type { SupabaseClient } from "@supabase/supabase-js";
import { sendAssistantReply } from "./send-reply";

export const AI_PRIVACY_NOTICE_FOOTER =
  "Digite DESATIVE a qualquer momento para falar só com a equipe humana.";

export function buildAiPrivacyNoticeText(clinicName: string): string {
  const clinic = clinicName.trim() || "clínica";
  return (
    `Olá! Sou o assistente virtual da ${clinic}. ` +
    `Esta conversa pode usar inteligência artificial para agendamentos e informações gerais. ` +
    `Não compartilhamos dados clínicos sensíveis com o provedor de IA. ` +
    `Saiba mais em flowmed.app/politica-de-privacidade. ` +
    AI_PRIVACY_NOTICE_FOOTER
  );
}

/** Envia aviso de privacidade/IA uma vez por conversa, se ainda não enviado. */
export async function ensureAiPrivacyNoticeSent(
  supabase: SupabaseClient,
  opts: {
    conversationId: string;
    clinicId: string;
    phoneNumber: string;
    clinicName: string;
    alreadySent: boolean | null | undefined;
  }
): Promise<boolean> {
  if (opts.alreadySent) return false;

  const text = buildAiPrivacyNoticeText(opts.clinicName);
  await sendAssistantReply(supabase, opts.clinicId, opts.conversationId, opts.phoneNumber, text, {
    skipHeader: true,
  });

  await supabase
    .from("whatsapp_conversations")
    .update({ ai_privacy_notice_sent_at: new Date().toISOString() })
    .eq("id", opts.conversationId);

  return true;
}
