"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type PatientCreditRow = {
  id: string;
  amount: number;
  used_amount: number;
  remaining: number;
  origin_comanda_id: string | null;
  expires_at: string | null;
  created_at: string;
};

export async function createPatientCredit(input: {
  patientId: string;
  amount: number;
  originComandaId?: string;
  notes?: string;
  expiresAt?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", creditId: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", creditId: null };
  if (profile.role !== "admin" && profile.role !== "secretaria") {
    return { error: "Sem permissão.", creditId: null };
  }

  const expiresAt =
    input.expiresAt ??
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("patient_credits")
    .insert({
      clinic_id: profile.clinic_id,
      patient_id: input.patientId,
      amount: input.amount,
      origin_comanda_id: input.originComandaId ?? null,
      notes: input.notes?.trim() || null,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.message.includes("patient_credits")) {
      return { error: "Migration v2-gaps não aplicada.", creditId: null };
    }
    return { error: error.message, creditId: null };
  }

  revalidatePath(`/dashboard/pacientes/${input.patientId}`);
  revalidatePath(`/dashboard/contatos/pacientes/${input.patientId}`);
  return { error: null, creditId: String(data.id) };
}

export async function listPatientCredits(patientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] as PatientCreditRow[] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: [] };

  const { data, error } = await supabase
    .from("patient_credits")
    .select("id, amount, used_amount, origin_comanda_id, expires_at, created_at")
    .eq("clinic_id", profile.clinic_id)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.includes("patient_credits")) {
      return { error: "Migration v2-gaps não aplicada.", data: [] };
    }
    return { error: error.message, data: [] };
  }

  return {
    error: null,
    data: (data ?? []).map((c) => ({
      id: String(c.id),
      amount: Number(c.amount),
      used_amount: Number(c.used_amount),
      remaining: Number(c.amount) - Number(c.used_amount),
      origin_comanda_id: c.origin_comanda_id ? String(c.origin_comanda_id) : null,
      expires_at: c.expires_at ? String(c.expires_at) : null,
      created_at: String(c.created_at),
    })),
  };
}

export async function listAvailablePatientCredits(patientId: string) {
  const res = await listPatientCredits(patientId);
  if (res.error) return res;
  const now = Date.now();
  return {
    error: null,
    data: res.data.filter((c) => {
      if (c.remaining <= 0) return false;
      if (c.expires_at && new Date(c.expires_at).getTime() < now) return false;
      return true;
    }),
    totalRemaining: res.data.reduce((s, c) => s + Math.max(0, c.remaining), 0),
  };
}

/** CORRIGIDO v2 — aplica crédito do paciente em pagamento de cupom (sem movimento de caixa). */
export async function applyPatientCredit(input: {
  creditId: string;
  patientId: string;
  amount: number;
  comandaId: string;
}) {
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

  const amount = Number(input.amount.toFixed(2));
  if (amount <= 0) return { error: null, applied: 0 };

  const { data: credit } = await supabase
    .from("patient_credits")
    .select("id, patient_id, amount, used_amount, clinic_id")
    .eq("id", input.creditId)
    .single();

  if (!credit || credit.patient_id !== input.patientId) {
    return { error: "Crédito não encontrado." };
  }
  if (credit.clinic_id !== profile.clinic_id) {
    return { error: "Crédito inválido para esta clínica." };
  }

  const remaining = Number(credit.amount) - Number(credit.used_amount);
  if (amount > remaining + 0.009) {
    return { error: `Crédito disponível: R$ ${remaining.toFixed(2).replace(".", ",")}.` };
  }

  const { error } = await supabase
    .from("patient_credits")
    .update({ used_amount: Number(credit.used_amount) + amount })
    .eq("id", input.creditId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/pacientes/${input.patientId}`);
  return { error: null, applied: amount };
}
