import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveMfaWizardRedirect } from "@/lib/compliance/mfa-redirect";

/**
 * Resolve o path de redirect após login (email/senha ou OAuth).
 * system_admin → /admin/system; admin/medico sem MFA → wizard.
 */
export async function resolvePostAuthRedirect(
  supabase: SupabaseClient,
  userId: string,
  redirectTo?: string
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role === "system_admin") {
    return "/admin/system";
  }

  const safeRedirect =
    redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : undefined;

  return resolveMfaWizardRedirect(supabase, userId, safeRedirect);
}

/**
 * Sanitiza um path de redirect — só aceita paths internos.
 */
export function sanitizeRedirectPath(path?: string, fallback = "/dashboard"): string {
  if (path && path.startsWith("/") && !path.startsWith("//")) {
    return path;
  }
  return fallback;
}
