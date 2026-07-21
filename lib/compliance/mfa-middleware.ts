import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMfaExemptPath, resolveAuthenticationDecision } from "@/lib/compliance/mfa-enforcement";
import { MFA_WIZARD_PATH } from "@/lib/compliance/mfa-helpers";

/**
 * Applies AuthenticationDecision.redirectToWizard — does not interpret MfaMode.
 */
export async function enforceMfaMiddleware(
  request: NextRequest,
  supabase: SupabaseClient
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/dashboard")) return null;
  if (isMfaExemptPath(pathname)) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const decision = await resolveAuthenticationDecision(supabase, profile?.role);
  if (!decision.redirectToWizard) return null;

  const url = request.nextUrl.clone();
  url.pathname = MFA_WIZARD_PATH;
  return NextResponse.redirect(url);
}
