"use server";

import { createClient } from "@/lib/supabase/server";

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
    .select("total_amount, closed_at, created_at, status")
    .eq("clinic_id", profile.clinic_id)
    .neq("status", "cancelada")
    .gte("created_at", start.toISOString());

  const byMonth: Record<string, number> = {};
  for (const c of comandas ?? []) {
    const ref = c.closed_at ?? c.created_at;
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
      .select("total_amount")
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

  const receita = (comandas ?? []).reduce((s, c) => s + Number(c.total_amount), 0);
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
