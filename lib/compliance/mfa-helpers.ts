/** Helpers para MFA TOTP (Supabase Auth). */

export const MFA_TOTP_FRIENDLY_NAME = "FlowMed";

export const MFA_WIZARD_PATH = "/dashboard/onboarding/mfa";

export type MfaFactor = {
  id: string;
  friendly_name?: string;
  factor_type?: string;
  status?: "verified" | "unverified";
};

export type MfaFactorsList = {
  all?: MfaFactor[];
  totp?: MfaFactor[];
  phone?: MfaFactor[];
};

export function getAllTotpFactors(factors: MfaFactorsList | null | undefined): MfaFactor[] {
  if (!factors) return [];
  const fromTotp = factors.totp ?? [];
  const fromAll = (factors.all ?? []).filter((f) => f.factor_type === "totp");
  const byId = new Map<string, MfaFactor>();
  for (const f of [...fromTotp, ...fromAll]) {
    byId.set(f.id, f);
  }
  return Array.from(byId.values());
}

export function getVerifiedTotpFactors(factors: MfaFactorsList | null | undefined): MfaFactor[] {
  return getAllTotpFactors(factors).filter((f) => f.status === "verified");
}

export function getUnverifiedTotpFactors(factors: MfaFactorsList | null | undefined): MfaFactor[] {
  return getAllTotpFactors(factors).filter((f) => f.status === "unverified");
}

export function isMfaEnrolled(factors: MfaFactorsList | null | undefined): boolean {
  return getVerifiedTotpFactors(factors).length > 0;
}

export function hasUnverifiedTotp(factors: MfaFactorsList | null | undefined): boolean {
  return getUnverifiedTotpFactors(factors).length > 0;
}

export function isFactorAlreadyExistsError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("already exists") || lower.includes("friendly name");
}
