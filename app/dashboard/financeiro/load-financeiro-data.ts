import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { parseMonthYear, getMonthPeriod } from "@/lib/financeiro/date-utils";
import {
  listOpenComandasDetailed,
  listPendingExpensesGrouped,
  listPendingManualReceitas,
  listFinancialEntries,
  listSuppliersForFinance,
  getFinanceAlerts,
} from "./actions";
import {
  getDashboardMetricsExtended,
  getFinanceChartData,
  getCompetenceReport,
  getCashFlowUnified,
} from "@/lib/financeiro/analytics";
import { fetchUnifiedLedger } from "@/lib/financeiro/unified-ledger";
import { getPresetFunnelPeriod } from "@/lib/analytics/time-buckets";

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

export async function loadFinanceiroOverview(searchParams: { year?: string; month?: string }) {
  const { canManage, userRole } = await loadFinanceiroAuth();
  const { year, month } = parseMonthYear(searchParams);

  const [
    { metrics, error: metricsError },
    { data: chartData },
    { data: openComandas },
    { data: suppliers },
    { alerts },
  ] = await Promise.all([
    getDashboardMetricsExtended(year, month),
    getFinanceChartData(year, month),
    listOpenComandasDetailed(),
    listSuppliersForFinance(),
    getFinanceAlerts(),
  ]);

  const defaultMetrics = {
    receitaFaturada: 0,
    entradasCaixa: 0,
    aReceber: 0,
    saidasCaixa: 0,
    aPagar: 0,
    aPagarVencidas: 0,
    aPagarVencendo7d: 0,
    resultadoPeriodo: 0,
    margemBruta: 0,
    ticketMedio: 0,
    taxaInadimplencia: 0,
    burnRate: 0,
    runway: 0,
    momReceitaPct: 0,
    projecao30d: 0,
    comandasNoPeriodo: 0,
    taxaNoShow: 0,
  };

  return {
    year,
    month,
    error: metricsError,
    metrics: metrics ?? defaultMetrics,
    chartData: chartData ?? {
      revenueVsExpenses: [],
      cashAccumulated: [],
      expenseMix: [],
      arAging: [],
      projection: [],
    },
    openComandas: openComandas ?? [],
    suppliers: suppliers ?? [],
    alerts: alerts ?? {
      comandasVencidas: 0,
      aguardandoEmissaoComanda: 0,
      contasVencerHojeAmanha: 0,
      contasVencidas: 0,
    },
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
  const [{ data: openComandas }, { data: manualReceitas }, { alerts }] = await Promise.all([
    listOpenComandasDetailed(),
    listPendingManualReceitas(),
    getFinanceAlerts(),
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
  const { data } = await getCompetenceReport(12);
  return { rows: data ?? [] };
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
      recebido: data.metrics.entradasCaixa,
      aReceber: data.metrics.aReceber,
      pago: data.metrics.saidasCaixa,
      aPagar: data.metrics.aPagar,
    },
    openComandas: data.openComandas,
    canManage: data.canManage,
  };
}
