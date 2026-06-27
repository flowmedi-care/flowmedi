"use server";

import { createClient } from "@/lib/supabase/server";
import {
  type FunnelPeriod,
  bucketKeyFromDate,
  formatBucketLabel,
  generateBucketKeys,
  getDefaultFunnelPeriod,
  parseFunnelPeriodDates,
  validateFunnelPeriod,
} from "@/lib/analytics/time-buckets";
import type {
  ComandaStatus,
  VendasDashboardMetrics,
  VendasNamedBreakdown,
  VendasRelatorioData,
  VendasRelatorioFilters,
  VendasRelatorioRow,
} from "@/lib/vendas/types";

export type { FunnelPeriod };
export type { VendasDashboardMetrics, VendasRelatorioData, VendasRelatorioFilters };

type RawComanda = {
  id: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  created_at: string;
  patient_id: string;
  appointment: {
    doctor_id: string;
    doctor: { full_name: string | null } | { full_name: string | null }[] | null;
  } | { doctor_id: string; doctor: { full_name: string | null } | null }[] | null;
  patient: { full_name: string } | { full_name: string }[] | null;
};

type RawComandaItem = {
  comanda_id: string;
  description: string;
  item_type: string;
  total_price: number;
};

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autorizado.", supabase, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.role === "medico") {
    return { error: "Sem permissão.", supabase, profile: null };
  }

  return { error: null, supabase, profile };
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function getPreviousPeriod(period: FunnelPeriod): FunnelPeriod {
  const { start, end } = parseFunnelPeriodDates(period);
  const days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  return {
    start: `${prevStart.getFullYear()}-${String(prevStart.getMonth() + 1).padStart(2, "0")}-${String(prevStart.getDate()).padStart(2, "0")}`,
    end: `${prevEnd.getFullYear()}-${String(prevEnd.getMonth() + 1).padStart(2, "0")}-${String(prevEnd.getDate()).padStart(2, "0")}`,
    granularity: period.granularity,
  };
}

async function fetchComandasInPeriod(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clinicId: string,
  period: FunnelPeriod
): Promise<RawComanda[]> {
  const { start, end } = parseFunnelPeriodDates(period);

  const { data } = await supabase
    .from("comandas")
    .select(
      `
      id,
      total_amount,
      paid_amount,
      status,
      created_at,
      patient_id,
      appointment:appointments (
        doctor_id,
        doctor:profiles!doctor_id ( full_name )
      ),
      patient:patients ( full_name )
    `
    )
    .eq("clinic_id", clinicId)
    .neq("status", "cancelada")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .order("created_at", { ascending: false });

  return (data ?? []) as RawComanda[];
}

async function fetchComandaItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  comandaIds: string[]
): Promise<RawComandaItem[]> {
  if (comandaIds.length === 0) return [];

  const { data } = await supabase
    .from("comanda_items")
    .select("comanda_id, description, item_type, total_price")
    .in("comanda_id", comandaIds);

  return (data ?? []) as RawComandaItem[];
}

function computeKpis(comandas: RawComanda[]) {
  const receitaFaturada = comandas.reduce((s, c) => s + Number(c.total_amount), 0);
  const comandasEmitidas = comandas.length;
  const ticketMedio = comandasEmitidas > 0 ? receitaFaturada / comandasEmitidas : 0;
  const totalPaid = comandas.reduce((s, c) => s + Number(c.paid_amount), 0);
  const taxaRecebimento = receitaFaturada > 0 ? (totalPaid / receitaFaturada) * 100 : 0;
  const valorEmAberto = comandas
    .filter((c) => c.status === "aberta" || c.status === "parcial")
    .reduce((s, c) => s + (Number(c.total_amount) - Number(c.paid_amount)), 0);

  return { receitaFaturada, comandasEmitidas, ticketMedio, taxaRecebimento, valorEmAberto };
}

function buildTimeSeries(
  comandas: RawComanda[],
  period: FunnelPeriod
): VendasDashboardMetrics["timeSeries"] {
  const { start, end } = parseFunnelPeriodDates(period);
  const keys = generateBucketKeys(start, end, period.granularity);
  const map = new Map<string, { receita: number; comandas: number }>();
  for (const key of keys) map.set(key, { receita: 0, comandas: 0 });

  for (const c of comandas) {
    const key = bucketKeyFromDate(new Date(c.created_at), period.granularity);
    const bucket = map.get(key);
    if (bucket) {
      bucket.receita += Number(c.total_amount);
      bucket.comandas += 1;
    }
  }

  return keys.map((dateKey) => ({
    dateKey,
    label: formatBucketLabel(dateKey, period.granularity),
    receita: map.get(dateKey)?.receita ?? 0,
    comandas: map.get(dateKey)?.comandas ?? 0,
  }));
}

function buildStatusBreakdown(comandas: RawComanda[]): VendasDashboardMetrics["statusBreakdown"] {
  const labels: Record<string, string> = {
    aberta: "Aberta",
    parcial: "Parcial",
    paga: "Paga",
  };
  const map = new Map<string, { count: number; total: number }>();
  for (const status of ["aberta", "parcial", "paga"] as ComandaStatus[]) {
    map.set(status, { count: 0, total: 0 });
  }
  for (const c of comandas) {
    const entry = map.get(c.status);
    if (entry) {
      entry.count += 1;
      entry.total += Number(c.total_amount);
    }
  }
  return (["aberta", "parcial", "paga"] as ComandaStatus[]).map((status) => ({
    status,
    label: labels[status] ?? status,
    count: map.get(status)?.count ?? 0,
    total: map.get(status)?.total ?? 0,
  }));
}

function buildTopServicos(items: RawComandaItem[]): VendasNamedBreakdown[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const item of items) {
    if (item.item_type !== "service" && item.item_type !== "procedure") continue;
    const entry = map.get(item.description) ?? { total: 0, count: 0 };
    entry.total += Number(item.total_price);
    entry.count += 1;
    map.set(item.description, entry);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)
    .map(([name, v]) => ({ name, total: v.total, count: v.count }));
}

function buildByProfissional(comandas: RawComanda[]): VendasNamedBreakdown[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const c of comandas) {
    const appt = unwrapRelation(c.appointment);
    const doctor = unwrapRelation(appt?.doctor);
    const name = doctor?.full_name?.trim() || "Sem profissional";
    const entry = map.get(name) ?? { total: 0, count: 0 };
    entry.total += Number(c.total_amount);
    entry.count += 1;
    map.set(name, entry);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)
    .map(([name, v]) => ({ name, total: v.total, count: v.count }));
}

function buildItemMix(items: RawComandaItem[]): VendasDashboardMetrics["itemMix"] {
  let servicos = 0;
  let materiais = 0;
  let outros = 0;
  for (const item of items) {
    const price = Number(item.total_price);
    if (item.item_type === "service" || item.item_type === "procedure") servicos += price;
    else if (item.item_type === "product") materiais += price;
    else outros += price;
  }
  return { servicos, materiais, outros };
}

function buildItemTags(items: RawComandaItem[]): string[] {
  const types = new Set<string>();
  for (const item of items) {
    if (item.item_type === "service" || item.item_type === "procedure") types.add("Serviço");
    else if (item.item_type === "product") types.add("Material");
    else types.add("Outro");
  }
  return [...types];
}

export async function getVendasDashboardMetrics(
  period: FunnelPeriod = getDefaultFunnelPeriod()
): Promise<{ error: string | null; data: VendasDashboardMetrics | null }> {
  const validationError = validateFunnelPeriod(period);
  if (validationError) return { error: validationError, data: null };

  const ctx = await getAuthContext();
  if (ctx.error || !ctx.profile) return { error: ctx.error, data: null };

  const comandas = await fetchComandasInPeriod(ctx.supabase, ctx.profile.clinic_id, period);
  const items = await fetchComandaItems(
    ctx.supabase,
    comandas.map((c) => c.id)
  );

  const kpis = computeKpis(comandas);

  const prevPeriod = getPreviousPeriod(period);
  const prevComandas = await fetchComandasInPeriod(
    ctx.supabase,
    ctx.profile.clinic_id,
    prevPeriod
  );
  const prevKpis = computeKpis(prevComandas);

  return {
    error: null,
    data: {
      ...kpis,
      trends: {
        receitaFaturada: pctChange(kpis.receitaFaturada, prevKpis.receitaFaturada),
        comandasEmitidas: pctChange(kpis.comandasEmitidas, prevKpis.comandasEmitidas),
        ticketMedio: pctChange(kpis.ticketMedio, prevKpis.ticketMedio),
        taxaRecebimento: pctChange(kpis.taxaRecebimento, prevKpis.taxaRecebimento),
      },
      timeSeries: buildTimeSeries(comandas, period),
      statusBreakdown: buildStatusBreakdown(comandas),
      topServicos: buildTopServicos(items),
      byProfissional: buildByProfissional(comandas),
      itemMix: buildItemMix(items),
      period,
    },
  };
}

/** @deprecated Use getVendasDashboardMetrics */
export async function getVendasOverview(days = 30) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  const period: FunnelPeriod = {
    start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
    end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`,
    granularity: "day",
  };
  const res = await getVendasDashboardMetrics(period);
  if (res.error || !res.data) return { error: res.error, data: null };
  return {
    error: null,
    data: {
      totalVendas: res.data.receitaFaturada,
      count: res.data.comandasEmitidas,
      ticketMedio: res.data.ticketMedio,
      topServicos: res.data.topServicos.map((s) => ({ name: s.name, total: s.total })),
      periodDays: days,
    },
  };
}

export async function getVendasRelatorioDetalhado(
  period: FunnelPeriod = getDefaultFunnelPeriod(),
  filters: VendasRelatorioFilters = {}
): Promise<{ error: string | null; data: VendasRelatorioData | null }> {
  const validationError = validateFunnelPeriod(period);
  if (validationError) return { error: validationError, data: null };

  const ctx = await getAuthContext();
  if (ctx.error || !ctx.profile) return { error: ctx.error, data: null };

  let comandas = await fetchComandasInPeriod(ctx.supabase, ctx.profile.clinic_id, period);
  const items = await fetchComandaItems(
    ctx.supabase,
    comandas.map((c) => c.id)
  );

  const itemsByComanda = new Map<string, RawComandaItem[]>();
  for (const item of items) {
    const list = itemsByComanda.get(item.comanda_id) ?? [];
    list.push(item);
    itemsByComanda.set(item.comanda_id, list);
  }

  if (filters.status?.length) {
    comandas = comandas.filter((c) => filters.status!.includes(c.status as ComandaStatus));
  }
  if (filters.professionalId) {
    comandas = comandas.filter((c) => {
      const appt = unwrapRelation(c.appointment);
      return appt?.doctor_id === filters.professionalId;
    });
  }
  if (filters.patientSearch?.trim()) {
    const q = filters.patientSearch.trim().toLowerCase();
    comandas = comandas.filter((c) => {
      const patient = unwrapRelation(c.patient);
      return patient?.full_name?.toLowerCase().includes(q);
    });
  }

  const professionalMap = new Map<string, string>();
  const rows: VendasRelatorioRow[] = comandas.map((c) => {
    const appt = unwrapRelation(c.appointment);
    const doctor = unwrapRelation(appt?.doctor);
    const patient = unwrapRelation(c.patient);
    const profId = appt?.doctor_id ?? null;
    const profName = doctor?.full_name?.trim() || "—";
    if (profId) professionalMap.set(profId, profName);

    return {
      id: c.id,
      created_at: c.created_at,
      patient_name: patient?.full_name ?? "—",
      patient_id: c.patient_id,
      professional_name: profName,
      professional_id: profId,
      total_amount: Number(c.total_amount),
      paid_amount: Number(c.paid_amount),
      balance: Number(c.total_amount) - Number(c.paid_amount),
      status: c.status as ComandaStatus,
      tags: buildItemTags(itemsByComanda.get(c.id) ?? []),
    };
  });

  const filteredIds = new Set(comandas.map((c) => c.id));
  const filteredItems = items.filter((i) => filteredIds.has(i.comanda_id));

  const { data: doctors } = await ctx.supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", ctx.profile.clinic_id)
    .eq("role", "medico")
    .order("full_name");

  return {
    error: null,
    data: {
      rows,
      byProcedimento: buildTopServicos(filteredItems),
      byProfissional: buildByProfissional(comandas),
      byPaciente: [...rows.reduce((map, row) => {
        const entry = map.get(row.patient_name) ?? { total: 0, count: 0 };
        entry.total += row.total_amount;
        entry.count += 1;
        map.set(row.patient_name, entry);
        return map;
      }, new Map<string, { total: number; count: number }>())]
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 10)
        .map(([name, v]) => ({ name, total: v.total, count: v.count })),
      professionals: (doctors ?? []).map((d) => ({
        id: d.id,
        name: d.full_name?.trim() || "Médico",
      })),
      period,
    },
  };
}

/** @deprecated Use getVendasRelatorioDetalhado */
export async function getVendasRelatorio(days = 30) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  const period: FunnelPeriod = {
    start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
    end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`,
    granularity: "day",
  };
  const res = await getVendasRelatorioDetalhado(period);
  if (res.error || !res.data) return { error: res.error, data: [] };
  return {
    error: null,
    data: res.data.rows.map((c) => ({
      id: c.id,
      total_amount: c.total_amount,
      paid_amount: c.paid_amount,
      status: c.status,
      created_at: c.created_at,
      patient_name: c.patient_name,
    })),
  };
}
