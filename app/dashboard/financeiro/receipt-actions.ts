"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function generateReceiptForPayment(paymentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", receiptId: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.clinic_id) return { error: "Clínica não encontrada.", receiptId: null };
  if (profile.role !== "admin" && profile.role !== "secretaria") {
    return { error: "Sem permissão.", receiptId: null };
  }

  const { data: existing } = await supabase
    .from("receipts")
    .select("id, receipt_number")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (existing) {
    return {
      error: null,
      receiptId: String(existing.id),
      receiptNumber: String(existing.receipt_number),
    };
  }

  const { data: payment } = await supabase
    .from("patient_payments")
    .select("id, patient_id, amount, net_amount, paid_at")
    .eq("id", paymentId)
    .single();

  if (!payment) return { error: "Pagamento não encontrado.", receiptId: null };

  const { count } = await supabase
    .from("receipts")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", profile.clinic_id);

  const seq = (count ?? 0) + 1;
  const year = new Date().getFullYear();
  const receiptNumber = `REC-${year}-${String(seq).padStart(5, "0")}`;

  const { data: receipt, error } = await supabase
    .from("receipts")
    .insert({
      clinic_id: profile.clinic_id,
      patient_id: payment.patient_id,
      payment_id: paymentId,
      receipt_number: receiptNumber,
      issued_at: payment.paid_at ?? new Date().toISOString(),
      created_by: user.id,
    })
    .select("id, receipt_number")
    .single();

  if (error) {
    if (error.message.includes("receipts")) {
      return { error: "Migration operational-flow-extensions não aplicada.", receiptId: null };
    }
    return { error: error.message, receiptId: null };
  }

  revalidatePath("/dashboard/financeiro/receber");
  return {
    error: null,
    receiptId: String(receipt.id),
    receiptNumber: String(receipt.receipt_number),
  };
}

export async function getReceiptPrintData(receiptId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };

  const { data: receipt } = await supabase
    .from("receipts")
    .select(
      `
      id,
      receipt_number,
      issued_at,
      patient:patients ( full_name ),
      payment:patient_payments ( amount, net_amount, payment_method, paid_at )
    `
    )
    .eq("id", receiptId)
    .single();

  if (!receipt) return { error: "Recibo não encontrado.", data: null };

  const patient = Array.isArray(receipt.patient) ? receipt.patient[0] : receipt.patient;
  const payment = Array.isArray(receipt.payment) ? receipt.payment[0] : receipt.payment;
  const pay = payment as { net_amount?: number; amount?: number; payment_method?: string; paid_at?: string };

  return {
    error: null,
    data: {
      receipt_number: String(receipt.receipt_number),
      issued_at: String(receipt.issued_at),
      patient_name: (patient as { full_name?: string })?.full_name ?? "—",
      amount: Number(pay.net_amount ?? pay.amount ?? 0),
      payment_method: pay.payment_method ?? null,
      paid_at: pay.paid_at ?? null,
    },
  };
}
