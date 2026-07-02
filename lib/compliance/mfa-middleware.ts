import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMfaExemptPath,
  requiresMfaForRole,
} from "@/lib/compliance/mfa-enforcement";
import { checkMfaEnrolled } from "@/lib/compliance/mfa-service";
import { MFA_WIZARD_PATH } from "@/lib/compliance/mfa-helpers";

/**
 * Redireciona admin/médico sem MFA verificado para o wizard.
 * Verificação por login (código TOTP) não é feita aqui.
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

  if (!requiresMfaForRole(profile?.role)) return null;

  const enrolled = await checkMfaEnrolled(supabase);
  if (enrolled) return null;

  const url = request.nextUrl.clone();
  url.pathname = MFA_WIZARD_PATH;
  return NextResponse.redirect(url);
}
