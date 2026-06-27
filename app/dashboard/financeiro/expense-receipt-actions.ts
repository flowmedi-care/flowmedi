"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function generateExpenseReceipt(financialEntryId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", receiptId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.role === "medico") {
    return { error: "Sem permissão.", receiptId: null };
  }

  const { data: existing } = await supabase
    .from("expense_receipts")
    .select("id")
    .eq("financial_entry_id", financialEntryId)
    .maybeSingle();

  if (existing?.id) {
    return { error: null, receiptId: existing.id as string };
  }

  const { data: entry } = await supabase
    .from("financial_entries")
    .select("id, clinic_id, status")
    .eq("id", financialEntryId)
    .eq("clinic_id", profile.clinic_id)
    .single();

  if (!entry || entry.status !== "pago") {
    return { error: "Lançamento não encontrado ou não pago.", receiptId: null };
  }

  const receiptNumber = `DESP-${Date.now().toString(36).toUpperCase()}`;

  const { data: receipt, error } = await supabase
    .from("expense_receipts")
    .insert({
      clinic_id: profile.clinic_id,
      financial_entry_id: financialEntryId,
      receipt_number: receiptNumber,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message, receiptId: null };
  revalidatePath("/dashboard/financeiro/extrato");
  return { error: null, receiptId: receipt?.id as string };
}

export async function getExpenseReceiptData(receiptId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };

  const { data: receipt } = await supabase
    .from("expense_receipts")
    .select(
      `
      id, receipt_number, created_at,
      entry:financial_entries (
        description, amount, paid_at, payment_method, category,
        supplier_name,
        supplier:suppliers ( name )
      ),
      clinic:clinics ( name, document )
    `
    )
    .eq("id", receiptId)
    .single();

  if (!receipt) return { error: "Comprovante não encontrado.", data: null };

  const entryRaw = Array.isArray(receipt.entry) ? receipt.entry[0] : receipt.entry;
  const clinic = Array.isArray(receipt.clinic) ? receipt.clinic[0] : receipt.clinic;
  const entry = entryRaw as Record<string, unknown> | null;
  const supplierRel = entry?.supplier;
  const supplier = Array.isArray(supplierRel) ? supplierRel[0] : supplierRel;

  return {
    error: null,
    data: {
      receiptNumber: receipt.receipt_number as string,
      createdAt: receipt.created_at as string,
      clinicName: (clinic as { name?: string })?.name ?? "Clínica",
      clinicDocument: (clinic as { document?: string })?.document ?? null,
      description: (entry?.description as string) ?? "",
      amount: Number(entry?.amount ?? 0),
      paidAt: (entry?.paid_at as string) ?? null,
      paymentMethod: (entry?.payment_method as string) ?? null,
      category: (entry?.category as string) ?? null,
      supplierName:
        (supplier as { name?: string })?.name ?? (entry?.supplier_name as string) ?? "—",
    },
  };
}
