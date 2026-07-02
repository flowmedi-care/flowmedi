import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve o path de redirect após login (email/senha ou OAuth).
 * system_admin → /admin/system; caso contrário redirectTo ou /dashboard.
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

  if (redirectTo && redirectTo.startsWith("/")) {
    return redirectTo;
  }

  return "/dashboard";
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
