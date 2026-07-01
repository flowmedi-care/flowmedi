import type { SupabaseClient } from "@supabase/supabase-js";

export type PaymentStatusSummary = {
  hasOpenComanda: boolean;
  comandaId: string | null;
  status: string | null;
  total_amount: number | null;
  paid_amount: number | null;
  remainder: number | null;
  message: string;
};

/** Somente leitura — nunca registra pagamento. */
export async function getPaymentStatusViaAssistant(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string
): Promise<PaymentStatusSummary> {
  const { data: comandas } = await supabase
    .from("comandas")
    .select("id, status, total_amount, paid_amount")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .in("status", ["aberta", "parcial"])
    .order("issued_at", { ascending: false })
    .limit(1);

  const comanda = comandas?.[0];
  if (!comanda) {
    return {
      hasOpenComanda: false,
      comandaId: null,
      status: null,
      total_amount: null,
      paid_amount: null,
      remainder: null,
      message: "Não há cobrança pendente registrada no sistema para este paciente.",
    };
  }

  const total = Number(comanda.total_amount);
  const paid = Number(comanda.paid_amount);
  const remainder = Math.max(0, total - paid);
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return {
    hasOpenComanda: true,
    comandaId: String(comanda.id),
    status: String(comanda.status),
    total_amount: total,
    paid_amount: paid,
    remainder,
    message:
      remainder > 0
        ? `Consta saldo pendente de ${fmt(remainder)} (total ${fmt(total)}, pago ${fmt(paid)}). Pagamentos são confirmados pela recepção.`
        : `Comanda com status ${comanda.status}.`,
  };
}
