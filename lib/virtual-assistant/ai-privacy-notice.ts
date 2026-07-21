import type { SupabaseClient } from "@supabase/supabase-js";
import { sendAssistantReply } from "./send-reply";
import {
  decidePrivacyNotice,
  getDefaultPrivacyNoticePolicy,
  mergePrivacyNoticePolicy,
  buildPrivacyNoticeBody,
  type PrivacyNoticePolicy,
  type PrivacyNoticePolicyInput,
} from "./policies/conversation/privacy-notice-policy";

/** @deprecated Prefer policy.optOutFooter — kept for callers expecting the constant. */
export const AI_PRIVACY_NOTICE_FOOTER = getDefaultPrivacyNoticePolicy().optOutFooter;

export function buildAiPrivacyNoticeText(clinicName: string): string {
  return buildPrivacyNoticeBody(getDefaultPrivacyNoticePolicy(), clinicName);
}

/**
 * Consumer of PrivacyNoticePolicy: applies PrivacyNoticeDecision (send or no-op).
 * Default policy mode is "disabled" — no proactive LGPD notice on first WhatsApp message.
 */
export async function ensureAiPrivacyNoticeSent(
  supabase: SupabaseClient,
  opts: {
    conversationId: string;
    clinicId: string;
    phoneNumber: string;
    clinicName: string;
    alreadySent: boolean | null | undefined;
    /** Optional override (e.g. enterprise first_message). */
    policyInput?: PrivacyNoticePolicyInput | null;
  }
): Promise<boolean> {
  const policy: PrivacyNoticePolicy = mergePrivacyNoticePolicy(opts.policyInput);
  const decision = decidePrivacyNotice(policy, {
    clinicName: opts.clinicName,
    alreadySent: Boolean(opts.alreadySent),
  });

  if (!decision.send) return false;

  await sendAssistantReply(
    supabase,
    opts.clinicId,
    opts.conversationId,
    opts.phoneNumber,
    decision.body,
    { skipHeader: true }
  );

  await supabase
    .from("whatsapp_conversations")
    .update({ ai_privacy_notice_sent_at: new Date().toISOString() })
    .eq("id", opts.conversationId);

  return true;
}
