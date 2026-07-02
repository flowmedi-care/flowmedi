/** Configuração LGPD / privacidade (variáveis de ambiente). */

const PRIVACY_POLICY_VERSION = "2026-07-02-v2";

export function getPrivacyPolicyVersion(): string {
  return PRIVACY_POLICY_VERSION;
}

export function getDpoContact(): { email: string; name: string | null } {
  const email =
    process.env.LGPD_DPO_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_LGPD_DPO_EMAIL?.trim() ||
    "privacidade@flowmed.app";
  const name = process.env.LGPD_DPO_NAME?.trim() || null;
  return { email, name };
}

export function getCompanyLegalName(): string {
  return process.env.LGPD_COMPANY_LEGAL_NAME?.trim() || "FlowMed";
}
