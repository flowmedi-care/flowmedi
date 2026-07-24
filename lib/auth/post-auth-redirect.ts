import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve o path de redirect após login (email/senha ou OAuth).
 * system_admin → /admin/system; demais → path seguro ou /dashboard.
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

  return sanitizeRedirectPath(redirectTo);
}

/**
 * Sanitiza um path de redirect — só aceita paths internos relativos.
 * Rejeita: https://..., //evil, javascript:, etc.
 */
export function sanitizeRedirectPath(path?: string, fallback = "/dashboard"): string {
  if (!path || typeof path !== "string") return fallback;

  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://")) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return fallback;
  if (trimmed.toLowerCase().startsWith("/\\")) return fallback;

  return trimmed;
}
