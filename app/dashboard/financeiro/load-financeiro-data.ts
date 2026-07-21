import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { parseMonthYear, getMonthPeriod } from "@/lib/financeiro/date-utils";
import {
  listOpenComandasDetailed,
  listPendingExpensesGrouped,
  listPendingManualReceitas,
  listSuppliersForFinance,
  getFinanceAlerts,
  getFinanceInboxData,
} from "./actions";
import {
  getFinanceChartData,
  getCompetenceReport,
  getCashFlowUnified,
  getRevenueOriginReport,
} from "@/lib/financeiro/analytics";
import { fetchUnifiedLedger } from "@/lib/financeiro/unified-ledger";
import { getPresetFunnelPeriod } from "@/lib/analytics/time-buckets";
import type {
  FinanceChartData,
  FinanceHomeIndicators,
  FinanceTodayBriefing,
} from "@/lib/financeiro/types";
import {
  getCompetencePipelineForecast,
  getReceberPipelineSnapshot,
  getPerformanceMetrics,
} from "@/lib/business-pipeline";
import type { ForecastResult, PerformanceMetrics } from "@/lib/business-pipeline";


export async function loadFinanceiroAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role === "medico") redirect("/dashboard");

  return {
    canManage: profile.role === "admin" || profile.role === "secretaria",
    userRole: profile.role as string,
    clinicId: profile.clinic_id as string,
  };
}

const emptyChart: FinanceChartData = {
  revenueVsExpenses: [],
  faturamentoVsDespesas: [],
  cashAccumulated: [],
  expenseMix: [],
  arAging: [],
  projection: [],
};

const emptyBriefing: FinanceTodayBriefing = {
  userFirstName: "",
  greeting: "Olá",
  cobrarCount: 0,
  receberCount: 0,
  entrouHoje: 0,
  cobrancasDoneToday: 0,
  cobrancasRemaining: 0,
  recebidosDoneToday: 0,
  recebidosTotal: 0,
};

const emptyIndicators: FinanceHomeIndicators = {
  entrouHoje: 0,
  aindaFaltaReceber: 0,
  contasVencidas: 0,
  contasAPagar: 0,
};

export async function loadFinanceiroOverview(searchParams: { year?: string; month?: string }) {
  const { canManage, userRole } = await loadFinanceiroAuth();
  const { year, month } = parseMonthYear(searchParams);

  const [inbox, { data: chartData }, { data: suppliers }] = await Promise.all([
    getFinanceInboxData(),
    getFinanceChartData(year, month),
    listSuppliersForFinance(),
  ]);

  return {
    year,
    month,
    error: inbox.error,
    briefing: inbox.briefing ?? emptyBriefing,
    indicators: inbox.indicators ?? emptyIndicators,
    chartData: chartData ?? emptyChart,
    cobrar: inbox.cobrar ?? [],
    receber: inbox.receber ?? [],
    recebido: inbox.recebido ?? [],
    suppliers: suppliers ?? [],
    canManage,
    userRole,
  };
}

export async function loadFinanceiroPagar() {
  const { canManage } = await loadFinanceiroAuth();
  const [{ data: expenses }, { data: suppliers }, { alerts }] = await Promise.all([
    listPendingExpensesGrouped(),
    listSuppliersForFinance(),
    getFinanceAlerts(),
  ]);
  return {
    expenses: expenses ?? [],
    suppliers: suppliers ?? [],
    alerts: alerts ?? {
      comandasVencidas: 0,
      aguardandoEmissaoComanda: 0,
      contasVencerHojeAmanha: 0,
      contasVencidas: 0,
    },
    canManage,
  };
}

export async function loadFinanceiroReceber() {
  const { canManage, userRole } = await loadFinanceiroAuth();
  const [{ data: openComandas }, { data: manualReceitas }, { alerts }, { data: pipeline }] =
    await Promise.all([
      listOpenComandasDetailed(),
      listPendingManualReceitas(),
      getFinanceAlerts(),
      getReceberPipelineSnapshot(),
    ]);
  return {
    openComandas: openComandas ?? [],
    manualReceitas: manualReceitas ?? [],
    alerts: alerts ?? {
      comandasVencidas: 0,
      aguardandoEmissaoComanda: 0,
      contasVencerHojeAmanha: 0,
      contasVencidas: 0,
    },
    pipeline: pipeline as ForecastResult | null,
    canManage,
    userRole,
  };
}

export async function loadFinanceiroExtrato(searchParams: { year?: string; month?: string }) {
  const { clinicId } = await loadFinanceiroAuth();
  const { year, month } = parseMonthYear(searchParams);
  const { startIso, endIso } = getMonthPeriod(year, month);

  const [ledger, { data: suppliers }] = await Promise.all([
    fetchUnifiedLedger(clinicId, startIso, endIso),
    listSuppliersForFinance(),
  ]);

  return { year, month, ledger, suppliers: suppliers ?? [] };
}

export async function loadFinanceiroCompetencia() {
  await loadFinanceiroAuth();
  const [{ data }, { data: origin }, { data: pipeline }] = await Promise.all([
    getCompetenceReport(12),
    getRevenueOriginReport(3),
    getCompetencePipelineForecast(1),
  ]);
  return { rows: data ?? [], origin: origin ?? [], pipeline: pipeline as ForecastResult | null };
}

export async function loadFinanceiroPerformance() {
  await loadFinanceiroAuth();
  const { data, error } = await getPerformanceMetrics();
  return { metrics: data as PerformanceMetrics | null, error };
}

export async function loadFinanceiroFluxoCaixa() {
  await loadFinanceiroAuth();
  const period = getPresetFunnelPeriod("30d");
  const { buckets, rows } = await getCashFlowUnified(period);
  return { period, buckets, rows };
}

/** @deprecated use loadFinanceiroOverview */
export async function loadFinanceiroPageData() {
  const data = await loadFinanceiroOverview({});
  return {
    error: data.error,
    entries: [],
    summary: {
      recebido: data.indicators.entrouHoje,
      aReceber: data.indicators.aindaFaltaReceber,
      pago: 0,
      aPagar: data.indicators.contasAPagar,
    },
    openComandas: data.receber.map((r) => ({
      id: r.comanda_id ?? r.id,
      status: "aberta",
      subtotal_amount: r.amount,
      discount_amount: 0,
      total_amount: r.amount,
      paid_amount: 0,
      remainder: r.remainder ?? r.amount,
      created_at: r.reference_at,
      patient_name: r.patient_name,
      scheduled_at: r.reference_at,
      service_name: r.service_name,
      days_open: r.days_open,
    })),
    canManage: data.canManage,
  };
}
