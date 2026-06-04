"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { mapPlanPolicyToAppointment } from "@/lib/financeiro/plan-schedule";

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

  await recalcTreatmentPlanSessionsUsed(treatmentPlanId);

  revalidatePath(`/dashboard/agenda/consulta/${appointmentId}`);
  revalidatePath("/dashboard/planos-tratamento");
  return { error: null };
}

export async function recalcTreatmentPlanSessionsUsed(treatmentPlanId: string) {
  const supabase = await createClient();

  const { data: comandas } = await supabase
    .from("comandas")
    .select("appointment_id")
    .eq("treatment_plan_id", treatmentPlanId)
    .neq("status", "cancelada");

  const apptIds = (comandas ?? [])
    .map((c) => c.appointment_id)
    .filter((id): id is string => !!id);

  if (!apptIds.length) {
    await supabase
      .from("treatment_plans")
      .update({ sessions_used: 0 })
      .eq("id", treatmentPlanId);
    return { sessions_used: 0 };
  }

  const { data: appts } = await supabase
    .from("appointments")
    .select("session_number")
    .in("id", apptIds);

  const maxSession = Math.max(
    0,
    ...(appts ?? []).map((a) => Number(a.session_number) || 0)
  );

  await supabase
    .from("treatment_plans")
    .update({ sessions_used: maxSession })
    .eq("id", treatmentPlanId);

  return { sessions_used: maxSession };
}

export async function registerPlanPayment(
  planId: string,
  amount: number,
  paymentMethod?: string,
  options?: {
    bank_account_id?: string;
    card_brand?: string;
    installments?: number;
    paidAt?: string;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };
  if (
    profile.role !== "admin" &&
    profile.role !== "secretaria" &&
    profile.role !== "medico"
  ) {
    return { error: "Sem permissão." };
  }
  if (!options?.bank_account_id) {
    return { error: "Selecione a conta bancária." };
  }

  const { data: plan } = await supabase
    .from("treatment_plans")
    .select("id, patient_id, total_amount, paid_amount")
    .eq("id", planId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!plan) return { error: "Plano não encontrado." };

  const remainder = Math.max(0, Number(plan.total_amount) - Number(plan.paid_amount));
  if (amount > remainder + 0.009) {
    return { error: `Valor máximo: R$ ${remainder.toFixed(2).replace(".", ",")}.` };
  }

  const paidAt = options?.paidAt
    ? new Date(
        options.paidAt + (options.paidAt.length <= 10 ? "T12:00:00" : "")
      ).toISOString()
    : new Date().toISOString();

  const { resolvePaymentFee } = await import("../financeiro/bank-account-actions");
  const feeCalc = await resolvePaymentFee(
    profile.clinic_id,
    paymentMethod ?? "pix",
    amount,
    { card_brand: options?.card_brand, installments: options?.installments }
  );

  const newPaid = Number(plan.paid_amount) + amount;
  await supabase
    .from("treatment_plans")
    .update({ paid_amount: newPaid })
    .eq("id", planId);

  const { data: paymentRow, error: payErr } = await supabase
    .from("patient_payments")
    .insert({
      clinic_id: profile.clinic_id,
      patient_id: plan.patient_id,
      amount,
      gross_amount: amount,
      fee_amount: feeCalc.feeAmount,
      net_amount: feeCalc.netAmount,
      bank_account_id: options.bank_account_id,
      installments: options?.installments ?? 1,
      card_brand: options?.card_brand ?? null,
      payment_method: paymentMethod ?? null,
      paid_at: paidAt,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (payErr) return { error: payErr.message };

  await supabase.from("financial_entries").insert({
    clinic_id: profile.clinic_id,
    entry_type: "receita",
    origin: "patient",
    description: "Pagamento plano de tratamento",
    amount,
    paid_at: paidAt,
    status: "pago",
    patient_id: plan.patient_id,
    bank_account_id: options.bank_account_id,
    payment_method: paymentMethod ?? null,
    created_by: user.id,
  });

  if (feeCalc.feeAmount > 0) {
    await supabase.from("financial_entries").insert({
      clinic_id: profile.clinic_id,
      entry_type: "despesa",
      origin: "automatic",
      description: "Taxa cartão — plano de tratamento",
      amount: feeCalc.feeAmount,
      paid_at: paidAt,
      status: "pago",
      category: "taxas_bancarias",
      patient_id: plan.patient_id,
      bank_account_id: options.bank_account_id,
      created_by: user.id,
    });
  }

  revalidatePath("/dashboard/planos-tratamento");
  revalidatePath(`/dashboard/pacientes/${plan.patient_id}`);
  return { error: null, paymentId: paymentRow?.id ? String(paymentRow.id) : null };
}

export async function listClinicDoctors() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] as { id: string; name: string }[] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: [] };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", profile.clinic_id)
    .eq("role", "medico")
    .order("full_name");

  if (error) return { error: error.message, data: [] };

  return {
    error: null,
    data: (data ?? []).map((d) => ({
      id: String(d.id),
      name: String(d.full_name ?? "Médico"),
    })),
  };
}

export async function generatePlanAppointments(
  planId: string,
  slots: { scheduled_at: string; doctor_id?: string; service_id?: string }[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", ids: [] as string[] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", ids: [] };
  if (profile.role !== "admin" && profile.role !== "secretaria") {
    return { error: "Sem permissão.", ids: [] };
  }

  const { data: plan } = await supabase
    .from("treatment_plans")
    .select("id, patient_id, sessions_total, clinic_id, payment_policy")
    .eq("id", planId)
    .single();

  if (!plan) return { error: "Plano não encontrado.", ids: [] };

  const { count: existingSessions } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("treatment_plan_id", planId);

  const slotsRemaining = plan.sessions_total - (existingSessions ?? 0);
  if (slots.length > slotsRemaining) {
    return {
      error: `Máximo de ${slotsRemaining} sessão(ões) restante(s) neste plano.`,
      ids: [],
    };
  }

  const appointmentPolicy = mapPlanPolicyToAppointment(
    plan.payment_policy != null ? String(plan.payment_policy) : null
  );

  const ids: string[] = [];
  const startSession = (existingSessions ?? 0) + 1;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const sessionNumber = startSession + i;
    const { data: appt, error } = await supabase
      .from("appointments")
      .insert({
        clinic_id: plan.clinic_id,
        patient_id: plan.patient_id,
        doctor_id: slot.doctor_id ?? null,
        service_id: slot.service_id ?? null,
        scheduled_at: slot.scheduled_at,
        status: "agendada",
        treatment_plan_id: planId,
        session_number: sessionNumber,
        payment_policy: appointmentPolicy,
      })
      .select("id")
      .single();

    if (error) return { error: error.message, ids };
    ids.push(String(appt.id));
  }

  await recalcTreatmentPlanSessionsUsed(planId);
  revalidatePath("/dashboard/planos-tratamento");
  revalidatePath("/dashboard/agenda");
  return { error: null, ids };
}
