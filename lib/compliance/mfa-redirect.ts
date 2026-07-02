import type { SupabaseClient } from "@supabase/supabase-js";
import { requiresMfaForRole } from "@/lib/compliance/mfa-enforcement";
import { MFA_WIZARD_PATH } from "@/lib/compliance/mfa-helpers";
import { checkMfaEnrolled } from "@/lib/compliance/mfa-service";

export { MFA_WIZARD_PATH };

/** Se admin/médico sem MFA verificado, redirecionar ao wizard. */
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

  if (!requiresMfaForRole(profile?.role)) {
    if (preferredPath && preferredPath.startsWith("/")) return preferredPath;
    return "/dashboard";
  }

  const enrolled = await checkMfaEnrolled(supabase);
  if (!enrolled) return MFA_WIZARD_PATH;

  if (preferredPath && preferredPath.startsWith("/")) return preferredPath;
  return "/dashboard";
}
