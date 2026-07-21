import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getUnverifiedTotpFactors,
  getVerifiedTotpFactors,
  isFactorAlreadyExistsError,
  isMfaEnrolled,
  MFA_TOTP_FRIENDLY_NAME,
  type MfaFactorsList,
} from "@/lib/compliance/mfa-helpers";

export type MfaEnrollResult =
  | { ok: true; factorId: string; qrCode: string }
  | { ok: false; error: string };

/** Remove todos os fatores TOTP não verificados (configuração incompleta). */
export async function unenrollUnverifiedTotpFactors(
  supabase: SupabaseClient
): Promise<{ error: string | null }> {
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return { error: listError.message };

  const unverified = getUnverifiedTotpFactors(factors as MfaFactorsList);
  for (const factor of unverified) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) return { error: error.message };
  }
  return { error: null };
}

/** Inicia enrollment TOTP, limpando fatores pendentes se necessário. */
export async function enrollTotpFactor(supabase: SupabaseClient): Promise<MfaEnrollResult> {
  const attempt = async (): Promise<MfaEnrollResult> => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: MFA_TOTP_FRIENDLY_NAME,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, factorId: data.id, qrCode: data.totp.qr_code };
  };

  const first = await attempt();
  if (first.ok) return first;

  if (isFactorAlreadyExistsError(first.error)) {
    const cleanup = await unenrollUnverifiedTotpFactors(supabase);
    if (cleanup.error) return { ok: false, error: cleanup.error };
    return attempt();
  }

  return first;
}

/** Confirma enrollment com código TOTP. */
export async function verifyTotpEnrollment(
  supabase: SupabaseClient,
  factorId: string,
  code: string
): Promise<{ error: string | null }> {
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) return { error: challenge.error.message };

  const verify = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code: code.trim(),
  });
  if (verify.error) return { error: verify.error.message };
  return { error: null };
}

/** Verifica sessão existente (login) com código TOTP. */
export async function verifyTotpLogin(
  supabase: SupabaseClient,
  code: string
): Promise<{ error: string | null }> {
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return { error: listError.message };

  const verified = getVerifiedTotpFactors(factors as MfaFactorsList);
  const totp = verified[0];
  if (!totp) return { error: "Nenhum autenticador configurado nesta conta." };

  return verifyTotpEnrollment(supabase, totp.id, code);
}

export async function checkMfaEnrolled(supabase: SupabaseClient): Promise<boolean> {
  const { data: factors } = await supabase.auth.mfa.listFactors();
  return isMfaEnrolled(factors as MfaFactorsList);
}

export async function needsMfaVerificationAtLogin(
  supabase: SupabaseClient
): Promise<boolean> {
  const {
    decideAuthentication,
    getActiveMfaPolicy,
  } = await import("@/lib/compliance/policies/mfa-policy");
  const enrolled = await checkMfaEnrolled(supabase);
  if (!enrolled) return false;

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const decision = decideAuthentication(getActiveMfaPolicy(), {
    role: null,
    mfaEnrolled: enrolled,
    aal: {
      currentLevel: aal?.currentLevel,
      nextLevel: aal?.nextLevel,
    },
  });
  return decision.challengeMfa;
}
