/**
 * PrivacyNoticePolicy — Decision Engine for AI/LGPD notices on conversations.
 * No side effects: decide* only returns PrivacyNoticeDecision.
 */

export type PrivacyNoticeMode = "disabled" | "first_message" | "on_demand";

export type PrivacyNoticePolicy = {
  mode: PrivacyNoticeMode;
  /** Footer hint when a notice is sent (opt-out command). */
  optOutFooter: string;
};

export type PrivacyNoticePolicyInput = Partial<PrivacyNoticePolicy>;

export type PrivacyNoticeDecision =
  | { send: false; reason: "disabled" | "already_sent" | "on_demand_not_requested" | string }
  | { send: true; body: string; reason: "first_message" | "on_demand" | string };

export type PrivacyNoticeContext = {
  clinicName: string;
  alreadySent: boolean;
  /** When mode is on_demand, consumer sets true to request a notice. */
  requested?: boolean;
};

const DEFAULT_OPT_OUT_FOOTER =
  "Digite DESATIVE a qualquer momento para falar só com a equipe humana.";

export function getDefaultPrivacyNoticePolicy(): PrivacyNoticePolicy {
  return {
    // Product default: no proactive WhatsApp LGPD notice (conversion / funnel).
    mode: "disabled",
    optOutFooter: DEFAULT_OPT_OUT_FOOTER,
  };
}

export function mergePrivacyNoticePolicy(
  input?: PrivacyNoticePolicyInput | null
): PrivacyNoticePolicy {
  const base = getDefaultPrivacyNoticePolicy();
  if (!input) return base;
  return {
    mode: input.mode ?? base.mode,
    optOutFooter: input.optOutFooter?.trim() || base.optOutFooter,
  };
}

export function buildPrivacyNoticeBody(
  policy: PrivacyNoticePolicy,
  clinicName: string
): string {
  const clinic = clinicName.trim() || "clínica";
  return (
    `Olá! Sou o assistente virtual da ${clinic}. ` +
    `Esta conversa pode usar inteligência artificial para agendamentos e informações gerais. ` +
    `Não compartilhamos dados clínicos sensíveis com o provedor de IA. ` +
    `Saiba mais em flowmed.app/politica-de-privacidade. ` +
    policy.optOutFooter
  );
}

export function decidePrivacyNotice(
  policy: PrivacyNoticePolicy,
  ctx: PrivacyNoticeContext
): PrivacyNoticeDecision {
  if (policy.mode === "disabled") {
    return { send: false, reason: "disabled" };
  }

  if (ctx.alreadySent) {
    return { send: false, reason: "already_sent" };
  }

  if (policy.mode === "on_demand" && !ctx.requested) {
    return { send: false, reason: "on_demand_not_requested" };
  }

  const reason = policy.mode === "first_message" ? "first_message" : "on_demand";
  return {
    send: true,
    body: buildPrivacyNoticeBody(policy, ctx.clinicName),
    reason,
  };
}
