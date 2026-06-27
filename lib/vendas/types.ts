import type { FunnelPeriod } from "@/lib/analytics/time-buckets";

export type ComandaStatus = "aberta" | "parcial" | "paga" | "cancelada";

export type VendasTimeBucket = {
  dateKey: string;
  label: string;
  receita: number;
  comandas: number;
};

export type VendasStatusBreakdown = {
  status: ComandaStatus;
  label: string;
  count: number;
  total: number;
};

export type VendasNamedBreakdown = {
  name: string;
  total: number;
  count: number;
};

export type VendasItemMix = {
  servicos: number;
  materiais: number;
  outros: number;
};

export type VendasDashboardMetrics = {
  receitaFaturada: number;
  comandasEmitidas: number;
  ticketMedio: number;
  taxaRecebimento: number;
  valorEmAberto: number;
  trends: {
    receitaFaturada: number;
    comandasEmitidas: number;
    ticketMedio: number;
    taxaRecebimento: number;
  };
  timeSeries: VendasTimeBucket[];
  statusBreakdown: VendasStatusBreakdown[];
  topServicos: VendasNamedBreakdown[];
  byProfissional: VendasNamedBreakdown[];
  itemMix: VendasItemMix;
  period: FunnelPeriod;
};

export type VendasRelatorioFilters = {
  status?: ComandaStatus[];
  professionalId?: string;
  patientSearch?: string;
};

export type VendasRelatorioRow = {
  id: string;
  created_at: string;
  patient_name: string;
  patient_id: string;
  professional_name: string;
  professional_id: string | null;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: ComandaStatus;
  tags: string[];
};

export type VendasRelatorioData = {
  rows: VendasRelatorioRow[];
  byProcedimento: VendasNamedBreakdown[];
  byProfissional: VendasNamedBreakdown[];
  byPaciente: VendasNamedBreakdown[];
  professionals: { id: string; name: string }[];
  period: FunnelPeriod;
};
