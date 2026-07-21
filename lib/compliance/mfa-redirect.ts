import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAuthenticationDecision } from "@/lib/compliance/mfa-enforcement";
import { MFA_WIZARD_PATH } from "@/lib/compliance/mfa-helpers";

export { MFA_WIZARD_PATH };

/** Applies AuthenticationDecision.redirectToWizard after login. */
export async function resolveMfaWizardRedirect(
  supabase: SupabaseClient,
  userId: string,
  preferredPath?: string
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  const decision = await resolveAuthenticationDecision(supabase, profile?.role);
  if (decision.redirectToWizard) return MFA_WIZARD_PATH;

  if (preferredPath && preferredPath.startsWith("/")) return preferredPath;
  return "/dashboard";
}
