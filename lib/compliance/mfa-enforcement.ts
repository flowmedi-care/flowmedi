/**
 * MFA path helpers + thin bridges to MfaPolicy / AuthenticationDecision.
 * Prefer decideAuthentication from @/lib/compliance/policies — do not interpret modes here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMfaEnrolled } from "@/lib/compliance/mfa-helpers";
import type { MfaFactorsList } from "@/lib/compliance/mfa-helpers";
import { MFA_WIZARD_PATH } from "@/lib/compliance/mfa-helpers";
import {
  decideAuthentication,
  getActiveMfaPolicy,
  MFA_ADMIN_ROLES,
  type AuthenticationDecision,
  type AuthenticationUserContext,
} from "@/lib/compliance/policies/mfa-policy";
import { checkMfaEnrolled } from "@/lib/compliance/mfa-service";

/** @deprecated Use MfaPolicy mode — kept for legacy imports / docs. */
export const MFA_REQUIRED_ROLES = MFA_ADMIN_ROLES;

export type MfaRequiredRole = (typeof MFA_ADMIN_ROLES)[number];

/**
 * @deprecated Prefer decideAuthentication(...).redirectToWizard
 * True only when active policy requires enrollment for this role.
 */
export function requiresMfaForRole(role: string | null | undefined): boolean {
  const decision = decideAuthentication(getActiveMfaPolicy(), {
    role,
    mfaEnrolled: false,
  });
  return decision.redirectToWizard;
}

/** Rotas isentas do bloqueio de enrollment MFA. */
export const MFA_EXEMPT_PATH_PREFIXES = [
  MFA_WIZARD_PATH,
  "/dashboard/configuracoes/privacidade",
  "/dashboard/configuracoes/seguranca",
  "/dashboard/onboarding",
  "/entrar",
  "/auth",
  "/acesso-removido",
  "/criar-conta",
  "/convite",
  "/redefinir-senha",
  "/esqueci-senha",
  "/auth/recuperar",
];

export function isMfaExemptPath(pathname: string): boolean {
  return MFA_EXEMPT_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function resolveAuthenticationDecision(
  supabase: SupabaseClient,
  role: string | null | undefined
): Promise<AuthenticationDecision> {
  const enrolled = await checkMfaEnrolled(supabase);
  const userCtx: AuthenticationUserContext = {
    role,
    mfaEnrolled: enrolled,
  };

  if (enrolled) {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    userCtx.aal = {
      currentLevel: data?.currentLevel,
      nextLevel: data?.nextLevel,
    };
  }

  return decideAuthentication(getActiveMfaPolicy(), userCtx);
}

export async function getMfaComplianceStatus(
  supabase: SupabaseClient
): Promise<{
  enrolled: boolean;
  needsVerification: boolean;
}> {
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const enrolled = isMfaEnrolled(factors as MfaFactorsList);

  if (!enrolled) {
    return { enrolled: false, needsVerification: false };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsVerification =
    aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2";

  return { enrolled: true, needsVerification };
}
