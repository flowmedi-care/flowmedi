import type { SupabaseClient } from "@supabase/supabase-js";

/** Papéis com MFA obrigatório (LGPD art. 46 — dados de saúde). */
export const MFA_REQUIRED_ROLES = ["admin", "medico"] as const;

export type MfaRequiredRole = (typeof MFA_REQUIRED_ROLES)[number];

export function requiresMfaForRole(role: string | null | undefined): boolean {
  return Boolean(role && MFA_REQUIRED_ROLES.includes(role as MfaRequiredRole));
}

/** Rotas do dashboard isentas do bloqueio MFA (configuração e logout). */
export const MFA_EXEMPT_PATH_PREFIXES = [
  "/dashboard/configuracoes/seguranca",
  "/entrar",
  "/auth",
  "/acesso-removido",
  "/criar-conta",
];

export function isMfaExemptPath(pathname: string): boolean {
  return MFA_EXEMPT_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function getMfaComplianceStatus(
  supabase: SupabaseClient
): Promise<{
  enrolled: boolean;
  needsVerification: boolean;
}> {
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const enrolled = (factors?.totp?.length ?? 0) > 0;

  if (!enrolled) {
    return { enrolled: false, needsVerification: false };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsVerification =
    aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2";

  return { enrolled: true, needsVerification };
}
