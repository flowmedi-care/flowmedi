import type { SupabaseClient } from "@supabase/supabase-js";

export type RecordPaymentAccountingInput = {
  clinicId: string;
  patientId: string;
  comandaId: string;
  grossAmount: number;
  feeAmount: number;
  bankAccountId?: string | null;
  paymentMethod?: string | null;
  cardBrand?: string | null;
  installments?: number;
  paidAt: string;
  createdBy: string;
  description?: string;
};

/** D4: caixa bruto + despesa MDR separada (taxas_bancarias). */
export async function recordPaymentAccounting(
  supabase: SupabaseClient,
  input: RecordPaymentAccountingInput
): Promise<{ error: string | null }> {
  const gross = Number(input.grossAmount.toFixed(2));
  const fee = Number(Math.max(0, input.feeAmount).toFixed(2));
  const desc = input.description ?? "Pagamento comanda";

  const { error: receitaErr } = await supabase.from("financial_entries").insert({
    clinic_id: input.clinicId,
    entry_type: "receita",
    origin: "patient",
    description: desc,
    amount: gross,
    paid_at: input.paidAt,
    status: "pago",
    patient_id: input.patientId,
    comanda_id: input.comandaId,
    bank_account_id: input.bankAccountId ?? null,
    payment_method: input.paymentMethod ?? null,
    created_by: input.createdBy,
  });

  if (receitaErr) return { error: receitaErr.message };

  if (fee > 0) {
    const brand = input.cardBrand ? ` ${input.cardBrand}` : "";
    const inst = input.installments && input.installments > 1 ? ` ${input.installments}x` : "";
    const { error: feeErr } = await supabase.from("financial_entries").insert({
      clinic_id: input.clinicId,
      entry_type: "despesa",
      origin: "automatic",
      description: `Taxa cartão${brand}${inst}`,
      amount: fee,
      paid_at: input.paidAt,
      status: "pago",
      category: "taxas_bancarias",
      patient_id: input.patientId,
      comanda_id: input.comandaId,
      bank_account_id: input.bankAccountId ?? null,
      payment_method: input.paymentMethod ?? null,
      created_by: input.createdBy,
    });
    if (feeErr) return { error: feeErr.message };
  }

  return { error: null };
}

export type RecordRefundAccountingInput = {
  clinicId: string;
  patientId: string;
  comandaId: string;
  amount: number;
  bankAccountId?: string | null;
  paidAt: string;
  createdBy: string;
  description?: string;
};

/** Estorno: saída no caixa (despesa origin refund). */
export async function recordRefundAccounting(
  supabase: SupabaseClient,
  input: RecordRefundAccountingInput
): Promise<{ error: string | null }> {
  const amount = Number(input.amount.toFixed(2));
  if (amount <= 0) return { error: null };

  const { error } = await supabase.from("financial_entries").insert({
    clinic_id: input.clinicId,
    entry_type: "despesa",
    origin: "refund",
    description: input.description ?? "Estorno comanda",
    amount,
    paid_at: input.paidAt,
    status: "pago",
    patient_id: input.patientId,
    comanda_id: input.comandaId,
    bank_account_id: input.bankAccountId ?? null,
    created_by: input.createdBy,
  });

  return { error: error?.message ?? null };
}
