"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type FinancialEntryRow = {
  id: string;
  entry_type: "receita" | "despesa";
  origin: string;
  description: string;
  amount: number;
  due_date: string | null;
  paid_at: string | null;
  status: string;
  supplier_name: string | null;
  patient_id: string | null;
};

export async function listFinancialEntries() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", data: [] };
  if (profile.role === "medico") return { error: "Sem permissão.", data: [] };

  const { data, error } = await supabase
    .from("financial_entries")
    .select("id, entry_type, origin, description, amount, due_date, paid_at, status, supplier_name, patient_id")
    .eq("clinic_id", profile.clinic_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return { error: error.message, data: [] };

  return {
    error: null,
    data: (data ?? []).map((r) => ({
      ...r,
      amount: Number(r.amount),
    })) as FinancialEntryRow[],
  };
}

export async function createFinancialEntry(data: {
  entry_type: "receita" | "despesa";
  origin: "patient" | "supplier" | "manual";
  description: string;
  amount: number;
  due_date?: string | null;
  supplier_name?: string | null;
  mark_paid?: boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada." };
  if (profile.role !== "admin" && profile.role !== "secretaria") {
    return { error: "Sem permissão." };
  }

  const { error } = await supabase.from("financial_entries").insert({
    clinic_id: profile.clinic_id,
    entry_type: data.entry_type,
    origin: data.origin,
    description: data.description.trim(),
    amount: data.amount,
    due_date: data.due_date ?? null,
    supplier_name: data.supplier_name ?? null,
    status: data.mark_paid ? "pago" : "pendente",
    paid_at: data.mark_paid ? new Date().toISOString() : null,
    created_by: user.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/financeiro");
  revalidatePath("/dashboard/financeiro/receber");
  revalidatePath("/dashboard/financeiro/pagar");
  revalidatePath("/dashboard/financeiro/extrato");
  return { error: null };
}

export async function markEntryPaid(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado." };

  const { error } = await supabase
    .from("financial_entries")
    .update({
      status: "pago",
      paid_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/financeiro");
  revalidatePath("/dashboard/financeiro/receber");
  revalidatePath("/dashboard/financeiro/pagar");
  revalidatePath("/dashboard/financeiro/extrato");
  return { error: null };
}

export async function getFinancialSummary() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", summary: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", summary: null };

  const { data: entries } = await supabase
    .from("financial_entries")
    .select("entry_type, amount, status")
    .eq("clinic_id", profile.clinic_id);

  let recebido = 0;
  let aReceber = 0;
  let pago = 0;
  let aPagar = 0;

  for (const e of entries ?? []) {
    const amt = Number(e.amount);
    if (e.entry_type === "receita") {
      if (e.status === "pago") recebido += amt;
    } else {
      if (e.status === "pago") pago += amt;
      else aPagar += amt;
    }
  }

  const { data: comandas } = await supabase
    .from("comandas")
    .select("total_amount, paid_amount, status")
    .eq("clinic_id", profile.clinic_id)
    .in("status", ["aberta", "parcial"]);

  for (const c of comandas ?? []) {
    aReceber += Math.max(0, Number(c.total_amount) - Number(c.paid_amount));
  }

  const { data: pendingManualReceitas } = await supabase
    .from("financial_entries")
    .select("amount")
    .eq("clinic_id", profile.clinic_id)
    .eq("entry_type", "receita")
    .eq("origin", "manual")
    .neq("status", "pago");

  for (const r of pendingManualReceitas ?? []) {
    aReceber += Number(r.amount);
  }

  return {
    error: null,
    summary: { recebido, aReceber, pago, aPagar },
  };
}
