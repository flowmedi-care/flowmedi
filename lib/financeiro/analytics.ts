"use server";

import { createClient } from "@/lib/supabase/server";
import {
  isComandaInPeriod,
  isComandaCompetenceEligible,
  comandaCompetenceDate,
} from "@/lib/financeiro/comanda-rules";
import {
  getMonthPeriod,
  todayDateOnly,
  daysOpenSince,
  addDaysDateOnly,
  toDateOnly,
} from "@/lib/financeiro/date-utils";
import { generateRecurrenceDates } from "@/lib/financeiro/recurrence";
import type {
  DashboardMetricsExtended,
  FinanceChartData,
  CompetenceMonthRow,
  ClinicFinancialSettings,
  RevenueOriginRow,
} from "@/lib/financeiro/types";
import type { FunnelPeriod } from "@/lib/analytics/time-buckets";
import { bucketKeyFromDate, formatBucketLabel } from "@/lib/analytics/time-buckets";
import { fetchUnifiedLedger } from "./unified-ledger";

async function getClinicFinanceContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", supabase, clinicId: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.role === "medico") {
    return { error: "Sem permissão.", supabase, clinicId: null };
  }
  return { error: null, supabase, clinicId: profile.clinic_id };
}

export async function getClinicFinancialSettings(): Promise<{
  error: string | null;
  settings: ClinicFinancialSettings;
}> {
  const ctx = await getClinicFinanceContext();
  if (ctx.error || !ctx.clinicId) {
    return { error: ctx.error, settings: { pecld_percent_ar: 2, ir_csll_percent_lair: 0 } };
  }

  const { data } = await ctx.supabase
    .from("clinic_financial_settings")
    .select("pecld_percent_ar, ir_csll_percent_lair")
    .eq("clinic_id", ctx.clinicId)
    .maybeSingle();

  return {
    error: null,
    settings: {
      pecld_percent_ar: Number(data?.pecld_percent_ar ?? 2),
      ir_csll_percent_lair: Number(data?.ir_csll_percent_lair ?? 0),
    },
  };
}

export async function upsertClinicFinancialSettings(settings: ClinicFinancialSettings) {
  const ctx = await getClinicFinanceContext();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error ?? "Erro" };

  const { error } = await ctx.supabase.from("clinic_financial_settings").upsert({
    clinic_id: ctx.clinicId,
    pecld_percent_ar: settings.pecld_percent_ar,
    ir_csll_percent_lair: settings.ir_csll_percent_lair,
    updated_at: new Date().toISOString(),
  });

  return { error: error?.message ?? null };
}

async function computeNoShowRate(supabase: Awaited<ReturnType<typeof createClient>>, clinicId: string) {
  const start = new Date();
  start.setDate(start.getDate() - 90);
  const { data: appts } = await supabase
    .from("appointments")
    .select("status")
    .eq("clinic_id", clinicId)
    .gte("scheduled_at", start.toISOString())
    .in("status", ["concluida", "falta", "cancelada"]);

  const total = (appts ?? []).filter((a) => a.status !== "cancelada").length;
  const faltas = (appts ?? []).filter((a) => a.status === "falta").length;
  return total > 0 ? faltas / total : 0;
}

async function computeCmvForPeriod(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  startIso: string,
  endIso: string
) {
  const { data: comandas } = await supabase
    .from("comandas")
    .select("id, total_amount, status, closed_at, created_at, issued_at")
    .eq("clinic_id", clinicId)
    .neq("status", "cancelada");

  const ids: string[] = [];
  for (const c of comandas ?? []) {
    if (isComandaInPeriod(c, startIso, endIso)) ids.push(c.id as string);
  }
  if (!ids.length) return 0;

  const { data: items } = await supabase
    .from("comanda_items")
    .select("quantity, unit_price, total_price, item_type, product_id, product:products ( cost )")
    .in("comanda_id", ids)
    .eq("item_type", "product");

  let cmv = 0;
  for (const item of items ?? []) {
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    const cost = Number((product as { cost?: number })?.cost ?? 0);
    const qty = Number(item.quantity ?? 1);
    cmv += cost > 0 ? cost * qty : Number(item.total_price);
  }
  return cmv;
}

export async function getDashboardMetricsExtended(
  year: number,
  month: number
): Promise<{ error: string | null; metrics: DashboardMetricsExtended | null }> {
  const ctx = await getClinicFinanceContext();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error, metrics: null };

  const { supabase, clinicId } = ctx;
  const { startIso, endIso } = getMonthPeriod(year, month);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const { startIso: prevStart, endIso: prevEnd } = getMonthPeriod(prevYear, prevMonth);

  const [
    { data: comandas },
    { data: prevComandas },
    { data: payments },
    { data: openComandas },
    { data: paidExpenses },
    { data: pendingExpenses },
    { data: pendingReceitas },
    taxaNoShow,
    cmv,
  ] = await Promise.all([
    supabase
      .from("comandas")
      .select("total_amount, status, closed_at, created_at, issued_at")
      .eq("clinic_id", clinicId)
      .neq("status", "cancelada"),
    supabase
      .from("comandas")
      .select("total_amount, status, closed_at, created_at, issued_at")
      .eq("clinic_id", clinicId)
      .neq("status", "cancelada"),
    supabase
      .from("patient_payments")
      .select("amount, gross_amount, paid_at, plan_prepaid, refunded_at, payment_method")
      .eq("clinic_id", clinicId)
      .gte("paid_at", startIso)
      .lte("paid_at", endIso)
      .is("refunded_at", null),
    supabase
      .from("comandas")
      .select("total_amount, paid_amount, created_at, appointment:appointments(status)")
      .eq("clinic_id", clinicId)
      .in("status", ["aberta", "parcial"])
      .not("issued_at", "is", null),
    supabase
      .from("financial_entries")
      .select("amount, paid_at")
      .eq("clinic_id", clinicId)
      .eq("entry_type", "despesa")
      .eq("status", "pago")
      .gte("paid_at", startIso)
      .lte("paid_at", endIso),
    supabase
      .from("financial_entries")
      .select("amount, due_date")
      .eq("clinic_id", clinicId)
      .eq("entry_type", "despesa")
      .eq("status", "pendente"),
    supabase
      .from("financial_entries")
      .select("amount, due_date")
      .eq("clinic_id", clinicId)
      .eq("entry_type", "receita")
      .eq("status", "pendente"),
    computeNoShowRate(supabase, clinicId),
    computeCmvForPeriod(supabase, clinicId, startIso, endIso),
  ]);

  let receitaFaturada = 0;
  let comandasNoPeriodo = 0;
  for (const c of comandas ?? []) {
    if (isComandaInPeriod(c, startIso, endIso)) {
      receitaFaturada += Number(c.total_amount);
      comandasNoPeriodo++;
    }
  }

  let prevReceita = 0;
  for (const c of prevComandas ?? []) {
    if (isComandaInPeriod(c, prevStart, prevEnd)) {
      prevReceita += Number(c.total_amount);
    }
  }

  const entradasCaixa = (payments ?? []).reduce((s, p) => {
    if (p.plan_prepaid || p.payment_method === "credito_interno") return s;
    return s + Number(p.gross_amount ?? p.amount);
  }, 0);
  const saidasCaixa = (paidExpenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

  let aReceber = 0;
  let aReceberVencido = 0;
  for (const c of openComandas ?? []) {
    const appt = Array.isArray(c.appointment) ? c.appointment[0] : c.appointment;
    if ((appt as { status?: string })?.status === "cancelada") continue;
    const rem = Math.max(0, Number(c.total_amount) - Number(c.paid_amount));
    aReceber += rem;
    if (daysOpenSince(String(c.created_at)) > 30) aReceberVencido += rem;
  }
  for (const r of pendingReceitas ?? []) {
    aReceber += Number(r.amount);
  }

  const today = todayDateOnly();
  const in7 = addDaysDateOnly(today, 7);
  let aPagar = 0;
  let aPagarVencidas = 0;
  let aPagarVencendo7d = 0;
  for (const e of pendingExpenses ?? []) {
    const amt = Number(e.amount);
    aPagar += amt;
    const due = toDateOnly(e.due_date);
    if (due && due < today) aPagarVencidas += amt;
    else if (due && due >= today && due <= in7) aPagarVencendo7d += amt;
  }

  const burnStart = new Date();
  burnStart.setMonth(burnStart.getMonth() - 3);
  const { data: burnExpenses } = await supabase
    .from("financial_entries")
    .select("amount, paid_at")
    .eq("clinic_id", clinicId)
    .eq("entry_type", "despesa")
    .eq("status", "pago")
    .gte("paid_at", burnStart.toISOString());

  const burnTotal = (burnExpenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const burnRate = burnTotal / 3;
  const runway = burnRate > 0 ? entradasCaixa / burnRate : 0;

  const momReceitaPct = prevReceita > 0 ? ((receitaFaturada - prevReceita) / prevReceita) * 100 : 0;
  const margemBruta = receitaFaturada - cmv;
  const ticketMedio = comandasNoPeriodo > 0 ? receitaFaturada / comandasNoPeriodo : 0;
  const taxaInadimplencia = aReceber > 0 ? (aReceberVencido / aReceber) * 100 : 0;

  const projecao30d = await computeCashProjection(clinicId, 30, taxaNoShow, aReceber);

  return {
    error: null,
    metrics: {
      receitaFaturada,
      entradasCaixa,
      aReceber,
      saidasCaixa,
      aPagar,
      aPagarVencidas,
      aPagarVencendo7d,
      resultadoPeriodo: entradasCaixa - saidasCaixa,
      margemBruta,
      ticketMedio,
      taxaInadimplencia,
      burnRate,
      runway,
      momReceitaPct,
      projecao30d,
      comandasNoPeriodo,
      taxaNoShow: taxaNoShow * 100,
    },
  };
}

async function computeCashProjection(
  clinicId: string,
  days: number,
  noShowRate: number,
  aReceber: number
): Promise<number> {
  const supabase = await createClient();
  const today = todayDateOnly();
  const endDate = addDaysDateOnly(today, days);

  const { data: series } = await supabase
    .from("financial_entry_series")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("active", true);

  let projected = 0;
  for (const s of series ?? []) {
    let next = s.next_due_date as string;
    if (!next) continue;
    const freq = s.frequency as "daily" | "weekly" | "monthly";
    const interval = Number(s.interval_count ?? 1);
    const amount = Number(s.amount);
    const endMode = s.end_mode as "count" | "until_date" | "never";
    const dates = generateRecurrenceDates({
      startDate: next,
      frequency: freq,
      interval_count: interval,
      end_mode: endMode,
      end_count: endMode === "count" ? Number(s.end_count) - Number(s.generated_count) : null,
      end_date: endMode === "until_date" ? (s.end_date as string) : endDate,
    });
    for (const d of dates) {
      if (d > endDate) break;
      if (d >= today) {
        projected += s.entry_type === "receita" ? amount : -amount;
      }
    }
  }

  projected += aReceber * (1 - noShowRate);
  return projected;
}

export async function getFinanceChartData(
  year: number,
  month: number
): Promise<{ error: string | null; data: FinanceChartData | null }> {
  const ctx = await getClinicFinanceContext();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error, data: null };

  const { startIso, endIso } = getMonthPeriod(year, month);
  const ledger = await fetchUnifiedLedger(ctx.clinicId, startIso, endIso);

  const byDay: Record<string, { revenue: number; expenses: number }> = {};
  const start = new Date(startIso);
  const end = new Date(endIso);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    byDay[key] = { revenue: 0, expenses: 0 };
  }

  for (const row of ledger) {
    const day = row.occurred_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { revenue: 0, expenses: 0 };
    if (row.type === "inflow") byDay[day].revenue += row.amount;
    else byDay[day].expenses += row.amount;
  }

  let cumulative = 0;
  const revenueVsExpenses = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => {
      const profit = v.revenue - v.expenses;
      cumulative += profit;
      return {
        date,
        label: new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        revenue: v.revenue,
        expenses: v.expenses,
        profit,
      };
    });

  const cashAccumulated = revenueVsExpenses.map((r, i) => {
    const bal = revenueVsExpenses.slice(0, i + 1).reduce((s, x) => s + x.profit, 0);
    return { date: r.date, label: r.label, balance: bal };
  });

  const expenseByCat: Record<string, number> = {};
  for (const row of ledger) {
    if (row.type !== "outflow") continue;
    const cat = row.category ?? "outros";
    expenseByCat[cat] = (expenseByCat[cat] ?? 0) + row.amount;
  }
  const expenseMix = Object.entries(expenseByCat).map(([name, value]) => ({ name, value }));

  const { data: openComandas } = await ctx.supabase
    .from("comandas")
    .select("total_amount, paid_amount, created_at")
    .eq("clinic_id", ctx.clinicId)
    .in("status", ["aberta", "parcial"]);

  const aging = { "0-7d": 0, "8-30d": 0, "31-60d": 0, "60d+": 0 };
  for (const c of openComandas ?? []) {
    const rem = Math.max(0, Number(c.total_amount) - Number(c.paid_amount));
    const days = daysOpenSince(String(c.created_at));
    if (days <= 7) aging["0-7d"] += rem;
    else if (days <= 30) aging["8-30d"] += rem;
    else if (days <= 60) aging["31-60d"] += rem;
    else aging["60d+"] += rem;
  }
  const arAging = Object.entries(aging).map(([bucket, amount]) => ({ bucket, amount }));

  const taxaNoShow = await computeNoShowRate(ctx.supabase, ctx.clinicId);
  const projection = revenueVsExpenses.map((r) => ({
    date: r.date,
    label: r.label,
    real: r.profit,
    projected: r.profit * (1 + (1 - taxaNoShow) * 0.1),
  }));

  const [{ data: comandasFat }, { data: expensesComp }] = await Promise.all([
    ctx.supabase
      .from("comandas")
      .select("total_amount, status, closed_at, created_at, issued_at")
      .eq("clinic_id", ctx.clinicId)
      .neq("status", "cancelada"),
    ctx.supabase
      .from("financial_entries")
      .select("amount, competence_date, due_date")
      .eq("clinic_id", ctx.clinicId)
      .eq("entry_type", "despesa")
      .neq("status", "cancelado"),
  ]);

  const fatByDay: Record<string, { revenue: number; expenses: number }> = {};
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    fatByDay[key] = { revenue: 0, expenses: 0 };
  }

  for (const c of comandasFat ?? []) {
    if (!isComandaCompetenceEligible(c)) continue;
    const ref = comandaCompetenceDate(c)?.slice(0, 10);
    if (!ref || !fatByDay[ref]) continue;
    fatByDay[ref].revenue += Number(c.total_amount);
  }
  for (const e of expensesComp ?? []) {
    const ref = ((e.competence_date as string) ?? (e.due_date as string) ?? "").slice(0, 10);
    if (!ref || !fatByDay[ref]) continue;
    fatByDay[ref].expenses += Number(e.amount);
  }

  const faturamentoVsDespesas = Object.entries(fatByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      label: new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      revenue: v.revenue,
      expenses: v.expenses,
      profit: v.revenue - v.expenses,
    }));

  return {
    error: null,
    data: {
      revenueVsExpenses,
      faturamentoVsDespesas,
      cashAccumulated,
      expenseMix,
      arAging,
      projection,
    },
  };
}

const ORIGIN_LABELS: Record<string, string> = {
  service: "Serviços",
  procedure: "Procedimentos",
  product: "Produtos",
  other: "Outros",
};

export async function getRevenueOriginReport(months = 3): Promise<{
  error: string | null;
  data: RevenueOriginRow[];
}> {
  const ctx = await getClinicFinanceContext();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error, data: [] };

  const start = new Date();
  start.setMonth(start.getMonth() - months);

  const { data: comandas } = await ctx.supabase
    .from("comandas")
    .select("id, status, closed_at, created_at, issued_at")
    .eq("clinic_id", ctx.clinicId)
    .neq("status", "cancelada")
    .gte("created_at", start.toISOString());

  const eligibleIds: string[] = [];
  for (const c of comandas ?? []) {
    if (!isComandaCompetenceEligible(c)) continue;
    eligibleIds.push(c.id as string);
  }

  if (eligibleIds.length === 0) return { error: null, data: [] };

  const { data: items } = await ctx.supabase
    .from("comanda_items")
    .select("item_type, total_price")
    .in("comanda_id", eligibleIds);

  const byType: Record<string, number> = {};
  for (const item of items ?? []) {
    const key = (item.item_type as string) || "other";
    byType[key] = (byType[key] ?? 0) + Number(item.total_price);
  }

  const data: RevenueOriginRow[] = Object.entries(byType)
    .map(([key, value]) => ({ name: ORIGIN_LABELS[key] ?? key, value }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  return { error: null, data };
}

export async function getCompetenceReport(months = 12): Promise<{
  error: string | null;
  data: CompetenceMonthRow[];
}> {
  const ctx = await getClinicFinanceContext();
  if (ctx.error || !ctx.clinicId) return { error: ctx.error, data: [] };

  const start = new Date();
  start.setMonth(start.getMonth() - months);

  const [{ data: comandas }, { data: expenses }] = await Promise.all([
    ctx.supabase
      .from("comandas")
      .select("total_amount, status, closed_at, created_at, issued_at")
      .eq("clinic_id", ctx.clinicId)
      .neq("status", "cancelada")
      .gte("created_at", start.toISOString()),
    ctx.supabase
      .from("financial_entries")
      .select("amount, competence_date, due_date, entry_type")
      .eq("clinic_id", ctx.clinicId)
      .eq("entry_type", "despesa")
      .neq("status", "cancelado"),
  ]);

  const byMonth: Record<string, { revenue: number; expenses: number }> = {};

  for (const c of comandas ?? []) {
    if (!isComandaCompetenceEligible(c)) continue;
    const ref = comandaCompetenceDate(c);
    const m = ref?.slice(0, 7);
    if (!m) continue;
    if (!byMonth[m]) byMonth[m] = { revenue: 0, expenses: 0 };
    byMonth[m].revenue += Number(c.total_amount);
  }

  for (const e of expenses ?? []) {
    const ref = (e.competence_date as string) ?? (e.due_date as string);
    if (!ref) continue;
    const m = ref.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = { revenue: 0, expenses: 0 };
    byMonth[m].expenses += Number(e.amount);
  }

  const data: CompetenceMonthRow[] = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => {
      const profit = v.revenue - v.expenses;
      return {
        month,
        label: new Date(month + "-01T12:00:00").toLocaleDateString("pt-BR", {
          month: "short",
          year: "numeric",
        }),
        revenue: v.revenue,
        expenses: v.expenses,
        profit,
        marginPct: v.revenue > 0 ? (profit / v.revenue) * 100 : 0,
      };
    });

  return { error: null, data };
}

export async function getCashFlowUnified(period: FunnelPeriod) {
  const ctx = await getClinicFinanceContext();
  if (ctx.error || !ctx.clinicId) {
    return { error: ctx.error, buckets: [], rows: [] };
  }

  const startIso = period.start + "T00:00:00.000Z";
  const endIso = period.end + "T23:59:59.999Z";
  const ledger = await fetchUnifiedLedger(ctx.clinicId, startIso, endIso);

  const bucketMap: Record<string, { inflow: number; outflow: number }> = {};
  for (const row of ledger) {
    const key = bucketKeyFromDate(new Date(row.occurred_at), period.granularity);
    if (!bucketMap[key]) bucketMap[key] = { inflow: 0, outflow: 0 };
    if (row.type === "inflow") bucketMap[key].inflow += row.amount;
    else bucketMap[key].outflow += row.amount;
  }

  let cumulative = 0;
  const buckets = Object.entries(bucketMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const net = v.inflow - v.outflow;
      cumulative += net;
      return {
        key,
        label: formatBucketLabel(key, period.granularity),
        inflow: v.inflow,
        outflow: v.outflow,
        net,
        cumulative,
      };
    });

  return { error: null, buckets, rows: ledger };
}

export { computeCmvForPeriod, computeNoShowRate };
