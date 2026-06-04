"use server";

import { createClient } from "@/lib/supabase/server";
import {
  isComandaCompetenceEligible,
  comandaCompetenceDate,
  isComandaInPeriod,
} from "@/lib/financeiro/comanda-rules";
import { getMonthPeriod, formatMonthLabel } from "@/lib/financeiro/date-utils";
import type { DreReport, DreLine, ExpenseCategory } from "@/lib/financeiro/types";
import { CATEGORY_LABELS } from "@/lib/financeiro/constants";

export type CashFlowDay = { date: string; inflow: number; outflow: number };
export type CompetenceMonth = { month: string; revenue: number; label: string };

export async function getCashFlowDaily(days = 30) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] as CashFlowDay[] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.role === "medico") {
    return { error: "Sem permissão.", data: [] };
  }

  const start = new Date();
  start.setDate(start.getDate() - days);
  const startIso = start.toISOString();

  const [{ data: payments }, { data: expenses }] = await Promise.all([
    supabase
      .from("patient_payments")
      .select("amount, paid_at, created_at")
      .eq("clinic_id", profile.clinic_id)
      .gte("created_at", startIso),
    supabase
      .from("financial_entries")
      .select("amount, paid_at")
      .eq("clinic_id", profile.clinic_id)
      .eq("entry_type", "despesa")
      .eq("status", "pago")
      .gte("paid_at", startIso),
  ]);

  const byDay: Record<string, { inflow: number; outflow: number }> = {};
  for (let i = 0; i <= days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - i));
    byDay[d.toISOString().slice(0, 10)] = { inflow: 0, outflow: 0 };
  }

  for (const p of payments ?? []) {
    const day = (p.paid_at ?? p.created_at)?.slice(0, 10);
    if (day && byDay[day]) byDay[day].inflow += Number(p.amount);
  }
  for (const e of expenses ?? []) {
    const day = e.paid_at?.slice(0, 10);
    if (day && byDay[day]) byDay[day].outflow += Number(e.amount);
  }

  const data: CashFlowDay[] = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  return { error: null, data };
}

export async function getCashFlowMonthly(months = 12) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: "Não autorizado.",
      data: [] as { month: string; label: string; inflow: number; outflow: number }[],
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.role === "medico") {
    return { error: "Sem permissão.", data: [] };
  }

  const start = new Date();
  start.setMonth(start.getMonth() - months);

  const [{ data: payments }, { data: expenses }] = await Promise.all([
    supabase
      .from("patient_payments")
      .select("amount, paid_at, created_at")
      .eq("clinic_id", profile.clinic_id)
      .gte("created_at", start.toISOString()),
    supabase
      .from("financial_entries")
      .select("amount, paid_at")
      .eq("clinic_id", profile.clinic_id)
      .eq("entry_type", "despesa")
      .eq("status", "pago")
      .not("paid_at", "is", null),
  ]);

  const byMonth: Record<string, { inflow: number; outflow: number }> = {};
  for (const p of payments ?? []) {
    const m = (p.paid_at ?? p.created_at)?.slice(0, 7);
    if (!m) continue;
    if (!byMonth[m]) byMonth[m] = { inflow: 0, outflow: 0 };
    byMonth[m].inflow += Number(p.amount);
  }
  for (const e of expenses ?? []) {
    const m = e.paid_at?.slice(0, 7);
    if (!m) continue;
    if (!byMonth[m]) byMonth[m] = { inflow: 0, outflow: 0 };
    byMonth[m].outflow += Number(e.amount);
  }

  const data = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      label: new Date(month + "-01T12:00:00").toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
      }),
      ...v,
    }));

  return { error: null, data };
}

export async function getCompetenceByMonth(months = 6) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: [] as CompetenceMonth[] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.role === "medico") {
    return { error: "Sem permissão.", data: [] };
  }

  const start = new Date();
  start.setMonth(start.getMonth() - months);

  const { data: comandas } = await supabase
    .from("comandas")
    .select("total_amount, closed_at, created_at, issued_at, status")
    .eq("clinic_id", profile.clinic_id)
    .neq("status", "cancelada")
    .gte("created_at", start.toISOString());

  const byMonth: Record<string, number> = {};
  for (const c of comandas ?? []) {
    if (!isComandaCompetenceEligible(c)) continue;
    const ref = comandaCompetenceDate(c);
    const m = ref?.slice(0, 7);
    if (!m) continue;
    byMonth[m] = (byMonth[m] ?? 0) + Number(c.total_amount);
  }

  const data: CompetenceMonth[] = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({
      month,
      revenue,
      label: new Date(month + "-01T12:00:00").toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
      }),
    }));

  return { error: null, data };
}

export async function getSimpleDre(months = 1) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.role === "medico") {
    return { error: "Sem permissão.", data: null };
  }

  const start = new Date();
  start.setMonth(start.getMonth() - months);

  const [{ data: comandas }, { data: expenses }] = await Promise.all([
    supabase
      .from("comandas")
      .select("total_amount, status, closed_at, created_at, issued_at")
      .eq("clinic_id", profile.clinic_id)
      .neq("status", "cancelada")
      .gte("created_at", start.toISOString()),
    supabase
      .from("financial_entries")
      .select("amount")
      .eq("clinic_id", profile.clinic_id)
      .eq("entry_type", "despesa")
      .eq("status", "pago")
      .gte("paid_at", start.toISOString()),
  ]);

  let receita = 0;
  for (const c of comandas ?? []) {
    if (isComandaCompetenceEligible(c)) receita += Number(c.total_amount);
  }
  const despesas = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

  return {
    error: null,
    data: {
      receitaBruta: receita,
      despesasOperacionais: despesas,
      resultado: receita - despesas,
    },
  };
}

// FINANCEIRO FASE 1 — ITEM 6: DRE detalhada por competência
export async function getDetailedDre(year: number, month: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", data: null as DreReport | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.role === "medico") {
    return { error: "Sem permissão.", data: null };
  }

  const { startIso, endIso } = getMonthPeriod(year, month);

  const [{ data: comandas }, { data: cancelled }, { data: expenses }] = await Promise.all([
    supabase
      .from("comandas")
      .select("id, total_amount, status, closed_at, created_at, issued_at")
      .eq("clinic_id", profile.clinic_id)
      .neq("status", "cancelada"),
    supabase
      .from("comandas")
      .select("total_amount, cancelled_at, created_at")
      .eq("clinic_id", profile.clinic_id)
      .eq("status", "cancelada"),
    supabase
      .from("financial_entries")
      .select("amount, category, paid_at")
      .eq("clinic_id", profile.clinic_id)
      .eq("entry_type", "despesa")
      .eq("status", "pago")
      .gte("paid_at", startIso)
      .lte("paid_at", endIso),
  ]);

  let receitaBruta = 0;
  const comandaIds: string[] = [];
  for (const c of comandas ?? []) {
    if (isComandaInPeriod(c, startIso, endIso)) {
      receitaBruta += Number(c.total_amount);
      comandaIds.push(c.id as string);
    }
  }

  let cancelamentos = 0;
  for (const c of cancelled ?? []) {
    const ref = (c.cancelled_at as string) ?? (c.created_at as string);
    if (ref >= startIso && ref <= endIso) {
      cancelamentos += Number(c.total_amount);
    }
  }

  const receitaLiquida = receitaBruta - cancelamentos;

  let cmv = 0;
  if (comandaIds.length > 0) {
    const { data: items } = await supabase
      .from("comanda_items")
      .select("total_price, item_type")
      .in("comanda_id", comandaIds)
      .eq("item_type", "product");

    cmv = (items ?? []).reduce((s, i) => s + Number(i.total_price), 0);
  }

  const margemBruta = receitaLiquida - cmv;

  const byCategory: Record<string, number> = {};
  for (const e of expenses ?? []) {
    const cat = (e.category as string) ?? "outros";
    byCategory[cat] = (byCategory[cat] ?? 0) + Number(e.amount);
  }

  const despesasTotal = Object.values(byCategory).reduce((s, v) => s + v, 0);
  const resultadoOperacional = margemBruta - despesasTotal;

  const lines: DreLine[] = [
    {
      key: "receita_bruta",
      label: "(+) Receita Faturada Bruta",
      value: receitaBruta,
      level: 0,
      tooltip: "Comandas fechadas ou pagas com data de fechamento no período (competência).",
    },
    {
      key: "cancelamentos",
      label: "(-) Cancelamentos",
      value: cancelamentos,
      level: 0,
      tooltip: "Comandas canceladas no período.",
    },
    {
      key: "receita_liquida",
      label: "(=) Receita Líquida de Atendimentos",
      value: receitaLiquida,
      level: 0,
      isTotal: true,
    },
  ];

  if (cmv > 0) {
    lines.push({
      key: "cmv",
      label: "(-) Custo de Materiais (CMV)",
      value: cmv,
      level: 0,
      tooltip: "Produtos e insumos faturados nas comandas do período.",
    });
    lines.push({
      key: "margem_bruta",
      label: "(=) Margem Bruta",
      value: margemBruta,
      level: 0,
      isTotal: true,
    });
  }

  lines.push({
    key: "despesas_header",
    label: "(-) Despesas Operacionais",
    value: despesasTotal,
    level: 0,
    tooltip: "Despesas pagas no período (caixa), agrupadas por categoria.",
  });

  const categoryOrder: ExpenseCategory[] = [
    "aluguel",
    "salarios",
    "materiais",
    "laboratorio",
    "equipamentos",
    "marketing",
    "outros",
  ];

  for (const cat of categoryOrder) {
    const val = byCategory[cat] ?? 0;
    if (val <= 0) continue;
    lines.push({
      key: `despesa_${cat}`,
      label: `• ${CATEGORY_LABELS[cat]}`,
      value: val,
      level: 1,
    });
  }

  lines.push({
    key: "resultado",
    label: "(=) Resultado Operacional",
    value: resultadoOperacional,
    level: 0,
    isTotal: true,
  });

  const report: DreReport = {
    year,
    month,
    monthLabel: formatMonthLabel(year, month),
    lines,
  };

  return { error: null, data: report };
}
