import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Erro de autenticação/autorização para rotas /api/* (sem redirect). */
export class ApiAuthError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiAuthError";
    this.status = status;
  }
}

export function toApiErrorResponse(
  error: unknown,
  options?: { defaultMessage?: string; defaultStatus?: number }
): NextResponse {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message =
    error instanceof Error ? error.message : options?.defaultMessage ?? "Erro interno";

  if (message === "Não autenticado" || message === "Usuário não pertence a uma clínica") {
    return NextResponse.json({ error: message }, { status: 401 });
  }

  return NextResponse.json(
    { error: message },
    { status: options?.defaultStatus ?? 500 }
  );
}

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
export async function requireClinicAdmin(noRedirect?: false): Promise<ClinicAdmin>;
export async function requireClinicAdmin(noRedirect: true): Promise<ClinicAdmin | null>;
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
 * Versão para rotas API: retorna 401/403 via ApiAuthError (sem redirect).
 */
export async function requireClinicAdminApi(): Promise<ClinicAdmin> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiAuthError(401, "Não autorizado.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, clinic_id, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.clinic_id || profile.active === false) {
    throw new ApiAuthError(401, "Não autorizado.");
  }

  if (profile.role !== "admin") {
    throw new ApiAuthError(403, "Apenas admin pode acessar.");
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
export async function requireSystemAdmin(noRedirect?: false): Promise<SystemAdmin>;
export async function requireSystemAdmin(noRedirect: true): Promise<SystemAdmin | null>;
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
 * Versão para rotas API: retorna 401/403 via ApiAuthError (sem redirect).
 */
export async function requireSystemAdminApi(): Promise<SystemAdmin> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiAuthError(401, "Não autorizado.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, active")
    .eq("id", user.id)
    .single();

  if (!profile || profile.active === false) {
    throw new ApiAuthError(401, "Não autorizado.");
  }

  if (profile.role !== "system_admin") {
    throw new ApiAuthError(403, "Não autorizado.");
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

export interface ClinicMemberWithRole {
  id: string;
  clinicId: string;
  role: string;
}

/**
 * Requer que o usuário seja membro de uma clínica e retorna também o role.
 */
export async function requireClinicMemberWithRole(): Promise<ClinicMemberWithRole> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Não autenticado");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.clinic_id || profile.active === false) {
    throw new Error("Usuário não pertence a uma clínica");
  }

  return {
    id: profile.id,
    clinicId: profile.clinic_id,
    role: profile.role ?? "secretaria",
  };
}
