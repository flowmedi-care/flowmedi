import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { parseMonthYear } from "@/lib/financeiro/date-utils";
import {
  getDashboardMetrics,
  listOpenComandasDetailed,
  listPendingExpensesGrouped,
  listPendingManualReceitas,
  listFinancialEntries,
  listSuppliersForFinance,
  getFinanceAlerts,
} from "./actions";

export async function loadFinanceiroAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role === "medico") redirect("/dashboard");

  return {
    canManage: profile.role === "admin" || profile.role === "secretaria",
    userRole: profile.role as string,
  };
}

export async function loadFinanceiroOverview(searchParams: { year?: string; month?: string }) {
  const { canManage, userRole } = await loadFinanceiroAuth();
  const { year, month } = parseMonthYear(searchParams);

  const [
    { metrics, error: metricsError },
    { data: openComandas },
    { data: suppliers },
    { alerts },
  ] = await Promise.all([
    getDashboardMetrics(year, month).then((r) => ({
      metrics: r.metrics,
      error: r.error,
    })),
    listOpenComandasDetailed(),
    listSuppliersForFinance(),
    getFinanceAlerts(),
  ]);

  return {
    year,
    month,
    error: metricsError,
    metrics: metrics ?? {
      receitaFaturada: 0,
      entradasCaixa: 0,
      aReceber: 0,
      saidasCaixa: 0,
      aPagar: 0,
      aPagarVencidas: 0,
      aPagarVencendo7d: 0,
      resultadoPeriodo: 0,
    },
    openComandas: openComandas ?? [],
    suppliers: suppliers ?? [],
    alerts: alerts ?? { comandasVencidas: 0, contasVencerHojeAmanha: 0, contasVencidas: 0 },
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
    alerts: alerts ?? { comandasVencidas: 0, contasVencerHojeAmanha: 0, contasVencidas: 0 },
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
    alerts: alerts ?? { comandasVencidas: 0, contasVencerHojeAmanha: 0, contasVencidas: 0 },
    canManage,
    userRole,
  };
}

export async function loadFinanceiroExtrato(searchParams: { year?: string; month?: string }) {
  await loadFinanceiroAuth();
  const { year, month } = parseMonthYear(searchParams);
  const [{ data: entries }, { data: suppliers }] = await Promise.all([
    listFinancialEntries({ year, month, limit: 1000 }),
    listSuppliersForFinance(),
  ]);
  return { year, month, entries: entries ?? [], suppliers: suppliers ?? [] };
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
