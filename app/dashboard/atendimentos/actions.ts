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
      pdf_path,
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
        pdf_path: d.pdf_path as string | null,
        patient_id: (patient as { id?: string })?.id,
        patient_name: (patient as { full_name?: string })?.full_name ?? "—",
        doctor_name: (doctor as { full_name?: string })?.full_name ?? "—",
      };
    }),
  };
}
