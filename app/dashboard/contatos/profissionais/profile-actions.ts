"use server";

import { createClient } from "@/lib/supabase/server";
import type { ProfessionalProfileBundle } from "./profile-types";

export type { ProfessionalProfileBundle } from "./profile-types";

export async function getProfessionalProfileBundle(
  professionalId: string
): Promise<{ error: string | null; data: ProfessionalProfileBundle | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };

  const { data: viewer } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!viewer?.clinic_id) return { error: "Clínica não encontrada.", data: null };

  const { data: professional, error: profErr } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, role, active, created_at, logo_url, logo_scale, cpf, crm, crm_uf, specialty, preferences"
    )
    .eq("id", professionalId)
    .eq("clinic_id", viewer.clinic_id)
    .in("role", ["medico", "secretaria", "admin"])
    .single();

  if (profErr || !professional) {
    return { error: "Profissional não encontrado.", data: null };
  }

  const [{ data: doctorProcedures }, { data: secretaryLinks }, { data: appointments }, { data: referral }, { count: colorCount }] =
    await Promise.all([
      professional.role === "medico"
        ? supabase
            .from("doctor_procedures")
            .select("procedure_id, procedures!procedure_id ( id, name )")
            .eq("clinic_id", viewer.clinic_id)
            .eq("doctor_id", professionalId)
        : Promise.resolve({ data: [] }),
      professional.role === "medico"
        ? supabase
            .from("secretary_doctors")
            .select("secretary_id, profiles!secretary_id ( id, full_name, email )")
            .eq("clinic_id", viewer.clinic_id)
            .eq("doctor_id", professionalId)
        : Promise.resolve({ data: [] }),
      professional.role === "medico"
        ? supabase
            .from("appointments")
            .select(
              "id, scheduled_at, status, patient:patients!patient_id ( full_name ), procedure:procedures!procedure_id ( name )"
            )
            .eq("clinic_id", viewer.clinic_id)
            .eq("doctor_id", professionalId)
            .order("scheduled_at", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [] }),
      professional.role === "medico"
        ? supabase
            .from("doctor_referral_codes")
            .select("custom_message")
            .eq("clinic_id", viewer.clinic_id)
            .eq("doctor_id", professionalId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      professional.role === "medico"
        ? supabase
            .from("profile_dimension_value_colors")
            .select("id", { count: "exact", head: true })
            .eq("profile_id", professionalId)
        : Promise.resolve({ count: 0 }),
    ]);

  const procedures = (doctorProcedures ?? [])
    .map((row: Record<string, unknown>) => {
      const proc = Array.isArray(row.procedures) ? row.procedures[0] : row.procedures;
      return proc as { id: string; name: string } | null;
    })
    .filter((p): p is { id: string; name: string } => !!p?.id);

  const secretaries = (secretaryLinks ?? [])
    .map((row: Record<string, unknown>) => {
      const sec = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return sec as { id: string; full_name: string | null; email: string | null } | null;
    })
    .filter((s): s is { id: string; full_name: string | null; email: string | null } => !!s?.id);

  const recentAppointments = (appointments ?? []).map((a: Record<string, unknown>) => {
    const patient = Array.isArray(a.patient) ? a.patient[0] : a.patient;
    const procedure = Array.isArray(a.procedure) ? a.procedure[0] : a.procedure;
    return {
      id: String(a.id),
      scheduled_at: String(a.scheduled_at),
      status: String(a.status),
      patient_name: (patient as { full_name?: string })?.full_name ?? null,
      procedure_name: (procedure as { name?: string })?.name ?? null,
    };
  });

  const doctorPrefs = (professional.preferences as Record<string, unknown> | null)?.doctor as
    | { late_threshold_minutes?: number }
    | undefined;

  return {
    error: null,
    data: {
      professional: {
        id: professional.id,
        full_name: professional.full_name,
        email: professional.email,
        role: professional.role,
        active: professional.active,
        created_at: professional.created_at,
        logo_url: professional.logo_url,
        logo_scale: professional.logo_scale,
        cpf: professional.cpf,
        crm: professional.crm,
        crm_uf: professional.crm_uf,
        specialty: professional.specialty,
        preferences: {
          doctor: doctorPrefs ?? {},
        },
      },
      procedures,
      secretaries,
      recentAppointments,
      referralMessage: referral?.custom_message ?? null,
      agendaColorCount: colorCount ?? 0,
    },
  };
}
