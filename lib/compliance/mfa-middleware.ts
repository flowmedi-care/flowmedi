import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getMfaComplianceStatus,
  isMfaExemptPath,
  requiresMfaForRole,
} from "@/lib/compliance/mfa-enforcement";

/**
 * Redireciona admin/médico sem MFA para a página de segurança.
 * Retorna null se não houver redirecionamento.
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

  const { enrolled, needsVerification } = await getMfaComplianceStatus(supabase);

  if (!enrolled) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/configuracoes/seguranca";
    url.searchParams.set("mfa_required", "1");
    return NextResponse.redirect(url);
  }

  if (needsVerification) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/configuracoes/seguranca";
    url.searchParams.set("mfa_verify", "1");
    return NextResponse.redirect(url);
  }

  return null;
}
