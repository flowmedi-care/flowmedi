"use server";

import type { FunnelPeriod } from "@/lib/analytics/time-buckets";
import type { VendasRelatorioFilters } from "@/lib/vendas/types";
import {
  getVendasDashboardMetrics as loadVendasDashboardMetrics,
  getVendasRelatorioDetalhado as loadVendasRelatorioDetalhado,
} from "@/lib/vendas-reports";

export async function getVendasDashboardMetrics(period: FunnelPeriod) {
  return loadVendasDashboardMetrics(period);
}

export async function getVendasRelatorioDetalhado(
  period: FunnelPeriod,
  filters: VendasRelatorioFilters = {}
) {
  return loadVendasRelatorioDetalhado(period, filters);
}
