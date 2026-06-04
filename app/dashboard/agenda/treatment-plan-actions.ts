"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type TreatmentPlanRow = {
  id: string;
  patient_id: string;
  patient_name: string;
  name: string;
  total_amount: number;
  paid_amount: number;
  sessions_total: number;
  sessions_used: number;
  payment_policy: string | null;
  status: string;
  created_at: string;
};

export async function listTreatmentPlans(patientId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] as TreatmentPlanRow[] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: [] };
  if (profile.role === "medico") return { error: "Sem permissão.", data: [] };

  let query = supabase
    .from("treatment_plans")
    .select(
      `
      id,
      patient_id,
      name,
      total_amount,
      paid_amount,
      sessions_total,
      sessions_used,
      payment_policy,
      status,
      created_at,
      patient:patients ( full_name )
    `
    )
    .eq("clinic_id", profile.clinic_id)
    .order("created_at", { ascending: false });

  if (patientId) query = query.eq("patient_id", patientId);

  const { data, error } = await query;
  if (error) {
    if (error.message.includes("treatment_plans")) {
      return { error: "Migration operational-flow-extensions não aplicada.", data: [] };
    }
    return { error: error.message, data: [] };
  }

  return {
    error: null,
    data: (data ?? []).map((r: Record<string, unknown>) => {
      const patient = Array.isArray(r.patient) ? r.patient[0] : r.patient;
      return {
        id: String(r.id),
        patient_id: String(r.patient_id),
        patient_name: (patient as { full_name?: string })?.full_name ?? "—",
        name: String(r.name),
        total_amount: Number(r.total_amount),
        paid_amount: Number(r.paid_amount),
        sessions_total: Number(r.sessions_total),
        sessions_used: Number(r.sessions_used),
        payment_policy: r.payment_policy != null ? String(r.payment_policy) : null,
        status: String(r.status),
        created_at: String(r.created_at),
      };
    }),
  };
}

export async function createTreatmentPlan(input: {
  patient_id: string;
  name: string;
  total_amount: number;
  sessions_total: number;
  payment_policy?: "antecipado" | "parcelado" | "por_sessao";
  notes?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", id: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", id: null };
  if (profile.role !== "admin" && profile.role !== "secretaria") {
    return { error: "Sem permissão.", id: null };
  }

  const { data, error } = await supabase
    .from("treatment_plans")
    .insert({
      clinic_id: profile.clinic_id,
      patient_id: input.patient_id,
      name: input.name.trim(),
      total_amount: input.total_amount,
      sessions_total: Math.max(1, input.sessions_total),
      payment_policy: input.payment_policy ?? "antecipado",
      notes: input.notes?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message, id: null };

  revalidatePath("/dashboard/planos-tratamento");
  revalidatePath(`/dashboard/pacientes/${input.patient_id}`);
  return { error: null, id: String(data.id) };
}

export async function linkAppointmentToPlan(
  appointmentId: string,
  treatmentPlanId: string,
  sessionNumber: number
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { error } = await supabase
    .from("appointments")
    .update({
      treatment_plan_id: treatmentPlanId,
      session_number: sessionNumber,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId);

  if (error) return { error: error.message };

  await supabase
    .from("treatment_plans")
    .update({ sessions_used: sessionNumber })
    .eq("id", treatmentPlanId);

  revalidatePath(`/dashboard/agenda/consulta/${appointmentId}`);
  revalidatePath("/dashboard/planos-tratamento");
  return { error: null };
}
