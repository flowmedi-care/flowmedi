/**
 * FinanceProjection — Case lê resumo; módulo Financeiro é dono dos dados.
 * Comandas: total_amount / paid_amount (reais), status aberta|parcial|paga|cancelada.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { JourneyCase } from "../types";

export type FinanceSummary = {
  status: "none" | "aberto" | "parcial" | "pago" | "atrasado";
  label: string;
  paidCents: number;
  totalCents: number;
  href: string;
};

function formatBRLFromReais(reais: number): string {
  return reais.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export async function buildFinanceSummary(
  db: SupabaseClient,
  journeyCase: JourneyCase
): Promise<FinanceSummary> {
  const empty: FinanceSummary = {
    status: "none",
    label: "Sem obrigação",
    paidCents: 0,
    totalCents: 0,
    href: "/dashboard/financeiro/receber",
  };

  if (!journeyCase.patient_id) return empty;

  const { data, error } = await db
    .from("comandas")
    .select("id, status, total_amount, paid_amount")
    .eq("clinic_id", journeyCase.clinic_id)
    .eq("patient_id", journeyCase.patient_id)
    .in("status", ["aberta", "parcial", "paga"])
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !data?.length) return empty;

  const open =
    data.find((c) => c.status === "aberta" || c.status === "parcial") ?? data[0];
  const total = Number(open.total_amount ?? 0);
  const paid = Number(open.paid_amount ?? 0);
  const totalCents = Math.round(total * 100);
  const paidCents = Math.round(paid * 100);
  const st = String(open.status ?? "");

  if (st === "paga") {
    return {
      status: "pago",
      label: `Pago · ${formatBRLFromReais(paid || total)}`,
      paidCents: paidCents || totalCents,
      totalCents,
      href: "/dashboard/financeiro/receber",
    };
  }
  if (st === "parcial") {
    return {
      status: "parcial",
      label: `Parcial · ${formatBRLFromReais(paid)} / ${formatBRLFromReais(total)}`,
      paidCents,
      totalCents,
      href: "/dashboard/financeiro/receber",
    };
  }
  return {
    status: "aberto",
    label: `Em aberto · ${formatBRLFromReais(total)}`,
    paidCents,
    totalCents,
    href: "/dashboard/financeiro/receber",
  };
}
