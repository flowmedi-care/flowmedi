-- Fluxo operacional v2.0 — lacunas L-05 a L-14 (incremental)

-- comandas: cancelamento tipado + vínculo plano
ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS cancellation_type text
    CHECK (cancellation_type IS NULL OR cancellation_type IN ('estorno', 'credito', 'perda'));

ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS treatment_plan_id uuid REFERENCES public.treatment_plans(id) ON DELETE SET NULL;

ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS session_revenue_amount numeric(12,2);

-- financial_entries: conta bancária + categoria taxas_bancarias
ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.financial_entries DROP CONSTRAINT IF EXISTS financial_entries_category_check;

ALTER TABLE public.financial_entries
  ADD CONSTRAINT financial_entries_category_check
  CHECK (category IS NULL OR category IN (
    'aluguel', 'salarios', 'materiais', 'laboratorio',
    'equipamentos', 'marketing', 'taxas_bancarias', 'outros'
  ));

CREATE INDEX IF NOT EXISTS idx_financial_entries_bank_account
  ON public.financial_entries(bank_account_id)
  WHERE bank_account_id IS NOT NULL;

-- patient_payments: sessão pré-paga no plano
ALTER TABLE public.patient_payments
  ADD COLUMN IF NOT EXISTS plan_prepaid boolean NOT NULL DEFAULT false;

-- créditos de paciente (cancelamento com crédito)
CREATE TABLE IF NOT EXISTS public.patient_credits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  used_amount numeric(12,2) NOT NULL DEFAULT 0,
  origin_comanda_id uuid REFERENCES public.comandas(id) ON DELETE SET NULL,
  notes text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_patient_credits_patient ON public.patient_credits(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_credits_clinic ON public.patient_credits(clinic_id);

ALTER TABLE public.patient_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_credits_clinic"
  ON public.patient_credits FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

-- receipts: vínculo cupom + PDF + anulação
ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS comanda_id uuid REFERENCES public.comandas(id) ON DELETE SET NULL;

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS pdf_url text;

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS voided_at timestamptz;

-- stock_lots: comprometido por lote
ALTER TABLE public.stock_lots
  ADD COLUMN IF NOT EXISTS quantity_committed numeric(12,3) NOT NULL DEFAULT 0;

-- stock_movements: auditoria consumo vencido
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS expired_at_consumption boolean NOT NULL DEFAULT false;

-- product_field_definitions: alertas de validade
ALTER TABLE public.product_field_definitions
  ADD COLUMN IF NOT EXISTS triggers_alert boolean NOT NULL DEFAULT false;

ALTER TABLE public.product_field_definitions
  ADD COLUMN IF NOT EXISTS alert_days_before int;

-- ponte appointment ↔ lote (FEFO)
CREATE TABLE IF NOT EXISTS public.appointment_stock_lots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  stock_lot_id uuid NOT NULL REFERENCES public.stock_lots(id) ON DELETE CASCADE,
  quantity numeric(12,3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, product_id, stock_lot_id)
);

CREATE INDEX IF NOT EXISTS idx_appointment_stock_lots_appt ON public.appointment_stock_lots(appointment_id);

ALTER TABLE public.appointment_stock_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointment_stock_lots_clinic"
  ON public.appointment_stock_lots FOR ALL
  USING (
    appointment_id IN (
      SELECT id FROM public.appointments
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    appointment_id IN (
      SELECT id FROM public.appointments
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
  );

COMMENT ON COLUMN public.comandas.cancellation_type IS 'estorno | credito | perda — quando cupom cancelado com pagamento';
COMMENT ON COLUMN public.patient_payments.plan_prepaid IS 'true quando sessão já paga no plano (sem movimento de caixa)';
COMMENT ON COLUMN public.financial_entries.bank_account_id IS 'Conta bancária do movimento (receita/despesa)';
