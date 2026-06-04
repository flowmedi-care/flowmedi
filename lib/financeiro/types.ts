// FINANCEIRO FASE 1 — tipos compartilhados

export type ExpenseCategory =
  | "aluguel"
  | "salarios"
  | "materiais"
  | "laboratorio"
  | "equipamentos"
  | "marketing"
  | "taxas_bancarias"
  | "outros";

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
  created_at: string;
  lens: FinancialLens;
};

export type OpenComandaRow = {
  id: string;
  status: string;
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
};

export type FinanceAlerts = {
  comandasVencidas: number;
  aguardandoEmissaoComanda: number;
  contasVencerHojeAmanha: number;
  contasVencidas: number;
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
