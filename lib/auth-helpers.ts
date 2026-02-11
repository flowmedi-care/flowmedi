import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Verifica se o usuário atual é system_admin
 * Retorna null se não for autorizado (para uso em API routes)
 * Usa redirect se não for autorizado (para uso em Server Components)
 */
export async function requireSystemAdmin(useRedirect = true): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (useRedirect) {
      redirect("/entrar?redirect=/admin/system");
    }
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "system_admin") {
    if (useRedirect) {
      redirect("/dashboard");
    }
    return null;
  }

  return { id: user.id, email: profile.email };
}

/**
 * Verifica se o usuário atual é admin da clínica
 */
export async function requireClinicAdmin(): Promise<{
  id: string;
  clinicId: string;
  email: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/entrar");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, clinic_id, email")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || !profile.clinic_id) {
    redirect("/dashboard");
  }

  return {
    id: user.id,
    clinicId: profile.clinic_id,
    email: profile.email,
  };
}
