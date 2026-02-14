import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com service role (ignora RLS).
 * Usar apenas no servidor, nunca expor no cliente.
 * Requer SUPABASE_SERVICE_ROLE_KEY no .env.local.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para createServiceRoleClient"
    );
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
