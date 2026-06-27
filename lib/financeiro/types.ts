// FINANCEIRO — tipos compartilhados

export type ExpenseCategory =
  | "aluguel"
  | "salarios"
  | "materiais"
  | "laboratorio"
  | "equipamentos"
  | "marketing"
  | "taxas_bancarias"
  | "depreciacao"
  | "pecld"
  | "impostos"
  | "financeiras"
  | "outros";

export type DreSection =
  | "receita"
  | "deducao"
  | "cmv"
  | "operacional"
  | "depreciacao"
  | "pecld"
  | "impostos";

export type RecurrenceFrequency = "daily" | "weekly" | "monthly";
export type RecurrenceEndMode = "count" | "until_date" | "never";

export type PaymentMethod =
  | "pix"
  | "transferencia"
  | "dinheiro"
  | "cartao"
  | "outro";

export type FinancialLens = "caixa" | "competencia" | "manual" | "previsto";

export type FinancialEntryRow = {
  id: string;
  entry_type: "receita" | "despesa";
  origin: string;
  description: string;
  amount: number;
  due_date: string | null;
  paid_at: string | null;
  status: string;
  supplier_name: string | null;
  supplier_id: string | null;
  supplier_display_name: string | null;
  patient_id: string | null;
  comanda_id: string | null;
  category: ExpenseCategory | null;
  payment_method: string | null;
  bank_account_id?: string | null;
  series_id?: string | null;
  series_index?: number | null;
  competence_date?: string | null;
  dre_section?: DreSection | null;
  created_at: string;
  lens: FinancialLens;
  is_recurring?: boolean;
};

export type OpenComandaRow = {
  id: string;
  status: string;
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  remainder: number;
  created_at: string;
  patient_name: string;
  scheduled_at: string | null;
  service_name: string | null;
  days_open: number;
};

export type DashboardMetrics = {
  receitaFaturada: number;
  entradasCaixa: number;
  aReceber: number;
  saidasCaixa: number;
  aPagar: number;
  aPagarVencidas: number;
  aPagarVencendo7d: number;
  resultadoPeriodo: number;
};

export type DashboardMetricsExtended = DashboardMetrics & {
  margemBruta: number;
  ticketMedio: number;
  taxaInadimplencia: number;
  burnRate: number;
  runway: number;
  momReceitaPct: number;
  projecao30d: number;
  comandasNoPeriodo: number;
  taxaNoShow: number;
};

export type ExpenseGroupKey =
  | "vencidas"
  | "hoje_amanha"
  | "proximos_7"
  | "futuras";

export type PendingExpenseRow = {
  id: string;
  description: string;
  amount: number;
  due_date: string | null;
  status: string;
  category: ExpenseCategory | null;
  supplier_id: string | null;
  supplier_display_name: string;
  days_until_due: number | null;
  group: ExpenseGroupKey;
  series_id?: string | null;
  is_recurring?: boolean;
};

export type FinanceAlerts = {
  comandasVencidas: number;
  aguardandoEmissaoComanda: number;
  contasVencerHojeAmanha: number;
  contasVencidas: number;
  projecaoCaixaNegativa30d?: boolean;
};

export type DreLine = {
  key: string;
  label: string;
  value: number;
  level: number;
  tooltip?: string;
  isTotal?: boolean;
};

export type DreReport = {
  month: number;
  year: number;
  monthLabel: string;
  lines: DreLine[];
};

export type UnifiedLedgerRow = {
  id: string;
  source: "payment" | "entry";
  occurred_at: string;
  type: "inflow" | "outflow";
  amount: number;
  running_balance: number;
  counterparty: string;
  counterparty_type: "patient" | "supplier" | "internal" | "other";
  source_label: string;
  description: string;
  payment_method: string | null;
  bank_account_name: string | null;
  comanda_id: string | null;
  patient_payment_id: string | null;
  financial_entry_id: string | null;
  receipt_id: string | null;
  category: ExpenseCategory | null;
  patient_id: string | null;
};

export type RecurrenceInput = {
  frequency: RecurrenceFrequency;
  interval_count: number;
  end_mode: RecurrenceEndMode;
  end_count?: number | null;
  end_date?: string | null;
};

export type StockLineInput = {
  product_id: string;
  quantity: number;
  unit_cost: number;
  lot_code?: string | null;
  expiry_date?: string | null;
};

export type ClinicFinancialSettings = {
  pecld_percent_ar: number;
  ir_csll_percent_lair: number;
};

export type FinanceChartData = {
  revenueVsExpenses: { date: string; label: string; revenue: number; expenses: number; profit: number }[];
  cashAccumulated: { date: string; label: string; balance: number }[];
  expenseMix: { name: string; value: number }[];
  arAging: { bucket: string; amount: number }[];
  projection: { date: string; label: string; real: number; projected: number }[];
};

export type CompetenceMonthRow = {
  month: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
  marginPct: number;
};

export type CashFlowBucket = {
  key: string;
  label: string;
  inflow: number;
  outflow: number;
  net: number;
  cumulative: number;
};
