import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface ClinicAdmin {
  id: string;
  clinicId: string;
}

interface SystemAdmin {
  id: string;
}

interface ClinicMember {
  id: string;
  clinicId: string;
}

/**
 * Requer que o usuário seja admin de uma clínica.
 * Se não for, redireciona para /dashboard (ou retorna null se noRedirect=true).
 */
export async function requireClinicAdmin(noRedirect = false): Promise<ClinicAdmin | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (noRedirect) return null;
    redirect("/entrar");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, clinic_id, active")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || !profile.clinic_id || profile.active === false) {
    if (noRedirect) return null;
    redirect("/dashboard");
  }

  return {
    id: profile.id,
    clinicId: profile.clinic_id,
  };
}

/**
 * Requer que o usuário seja system_admin.
 * Se não for, redireciona para /dashboard (ou retorna null se noRedirect=true).
 */
export async function requireSystemAdmin(noRedirect = false): Promise<SystemAdmin | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (noRedirect) return null;
    redirect("/entrar");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, active")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "system_admin" || profile.active === false) {
    if (noRedirect) return null;
    redirect("/dashboard");
  }

  return {
    id: profile.id,
  };
}

/**
 * Requer que o usuário seja membro de uma clínica (qualquer role).
 * Se não for, retorna erro 401.
 */
export async function requireClinicMember(): Promise<ClinicMember> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Não autenticado");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.clinic_id || profile.active === false) {
    throw new Error("Usuário não pertence a uma clínica");
  }

  return {
    id: profile.id,
    clinicId: profile.clinic_id,
  };
}
