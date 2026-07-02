"use server";

import { createClient } from "@/lib/supabase/server";

/** Auditoria: listagem com filtros */
export async function getAuditLog(
  clinicId: string,
  opts: { userId?: string; from?: string; to?: string; limit?: number } = {}
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { data: null, error: "Apenas administradores podem acessar o log de auditoria." };
  }

  let q = supabase
    .from("audit_log")
    .select(
      `
      id,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values,
      created_at,
      profiles!user_id ( id, full_name, email )
    `
    )
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50);

  if (opts.userId) q = q.eq("user_id", opts.userId);
  if (opts.from) q = q.gte("created_at", opts.from);
  if (opts.to) q = q.lte("created_at", opts.to);

  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}
