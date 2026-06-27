"use server";

import { createClient } from "@/lib/supabase/server";

export async function listClinicalDocumentsByType(
  documentType: "prescription" | "exam_request" | "certificate"
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: [] };

  const { data, error } = await supabase
    .from("clinical_documents")
    .select(
      `
      id,
      type,
      appointment_id,
      body_rendered,
      created_at,
      patient:patients ( id, full_name ),
      doctor:profiles!doctor_id ( full_name )
    `
    )
    .eq("clinic_id", profile.clinic_id)
    .eq("type", documentType)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { error: error.message, data: [] };

  return {
    error: null,
    data: (data ?? []).map((d: Record<string, unknown>) => {
      const patient = Array.isArray(d.patient) ? d.patient[0] : d.patient;
      const doctor = Array.isArray(d.doctor) ? d.doctor[0] : d.doctor;
      return {
        id: d.id as string,
        created_at: d.created_at as string,
        appointment_id: d.appointment_id as string | null,
        body_rendered: d.body_rendered as string | null,
        patient_id: (patient as { id?: string })?.id,
        patient_name: (patient as { full_name?: string })?.full_name ?? "—",
        doctor_name: (doctor as { full_name?: string })?.full_name ?? "—",
      };
    }),
  };
}

export async function listAtestadoInstances() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: [] };

  const { data: templates } = await supabase
    .from("clinical_ficha_templates")
    .select("id")
    .eq("clinic_id", profile.clinic_id)
    .eq("slug", "atestado");

  const templateIds = (templates ?? []).map((t) => t.id);
  if (templateIds.length === 0) return { error: null, data: [] };

  const { data, error } = await supabase
    .from("appointment_ficha_instances")
    .select(
      `
      id,
      created_at,
      responses,
      appointment:appointments (
        id,
        patient:patients ( id, full_name )
      )
    `
    )
    .in("ficha_template_id", templateIds)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { error: error.message, data: [] };

  return {
    error: null,
    data: (data ?? []).map((row: Record<string, unknown>) => {
      const appt = Array.isArray(row.appointment) ? row.appointment[0] : row.appointment;
      const patient = appt
        ? Array.isArray((appt as { patient?: unknown }).patient)
          ? (appt as { patient: { full_name?: string; id?: string }[] }).patient[0]
          : (appt as { patient?: { full_name?: string; id?: string } }).patient
        : null;
      const fv = row.responses as Record<string, unknown> | null;
      const texto = fv?.["atestado-texto"];
      return {
        id: row.id as string,
        created_at: row.created_at as string,
        patient_name: patient?.full_name ?? "—",
        patient_id: patient?.id,
        appointment_id: (appt as { id?: string })?.id,
        preview: texto ? String(texto).slice(0, 80) : "Atestado",
      };
    }),
  };
}
