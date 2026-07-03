import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getNonRegisteredSubmitters } from "../formularios/actions";
import type { Patient } from "./pacientes-client";

export type PacientesShell = {
  clinicId: string;
  userRole: string;
};

export async function loadPacientesShell(): Promise<PacientesShell> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) redirect("/dashboard");

  return {
    clinicId: profile.clinic_id,
    userRole: profile.role || "admin",
  };
}

export async function loadPacientesList(clinicId: string): Promise<Patient[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("patients")
    .select(
      "id, full_name, email, phone, birth_date, cpf, notes, photo_url, custom_fields, created_at"
    )
    .eq("clinic_id", clinicId)
    .order("full_name");

  return (rows ?? []).map((r) => ({
    id: r.id,
    full_name: r.full_name,
    email: r.email,
    phone: r.phone,
    birth_date: r.birth_date,
    cpf: r.cpf ?? null,
    notes: r.notes,
    photo_url: r.photo_url ?? null,
    custom_fields: (r.custom_fields as Record<string, unknown>) || {},
    created_at: r.created_at,
  }));
}

export async function loadPacientesMeta(clinicId: string) {
  const supabase = await createClient();

  const [{ data: customFields }, nonRegisteredRes] = await Promise.all([
    supabase
      .from("patient_custom_fields")
      .select("id, field_name, field_type, field_label, required, options, display_order")
      .eq("clinic_id", clinicId)
      .order("display_order"),
    getNonRegisteredSubmitters(),
  ]);

  return {
    customFields: customFields ?? [],
    nonRegistered: nonRegisteredRes.data || [],
  };
}
