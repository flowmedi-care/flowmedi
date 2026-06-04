-- Extensões do fluxo operacional: check-in, bancos, planos, lotes

-- Fase 1: política de pagamento no check-in
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS payment_policy text
    CHECK (payment_policy IS NULL OR payment_policy IN ('antecipado', 'no_dia', 'pos_atendimento'));

COMMENT ON COLUMN public.appointments.payment_policy IS 'Check-in: antecipado, no_dia ou pos_atendimento';

-- Fase 2: contas bancárias
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  bank_name text,
  agency text,
  account_number text,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_clinic ON public.bank_accounts(clinic_id);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_accounts_clinic"
  ON public.bank_accounts FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

-- Fase 2: taxas de cartão (MDR)
CREATE TABLE IF NOT EXISTS public.payment_fee_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  payment_method text NOT NULL DEFAULT 'cartao',
  card_brand text,
  installments int NOT NULL DEFAULT 1,
  fee_percent numeric(5,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_fee_rules_clinic ON public.payment_fee_rules(clinic_id);

ALTER TABLE public.payment_fee_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_fee_rules_clinic"
  ON public.payment_fee_rules FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

ALTER TABLE public.patient_payments
  ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.patient_payments
  ADD COLUMN IF NOT EXISTS gross_amount numeric(12,2);

ALTER TABLE public.patient_payments
  ADD COLUMN IF NOT EXISTS fee_amount numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.patient_payments
  ADD COLUMN IF NOT EXISTS net_amount numeric(12,2);

ALTER TABLE public.patient_payments
  ADD COLUMN IF NOT EXISTS installments int NOT NULL DEFAULT 1;

ALTER TABLE public.patient_payments
  ADD COLUMN IF NOT EXISTS card_brand text;

UPDATE public.patient_payments
SET gross_amount = COALESCE(gross_amount, amount),
    net_amount = COALESCE(net_amount, amount)
WHERE gross_amount IS NULL OR net_amount IS NULL;

-- Fase 2: recibos
CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.patient_payments(id) ON DELETE CASCADE,
  receipt_number text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (clinic_id, receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_receipts_payment ON public.receipts(payment_id);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipts_clinic"
  ON public.receipts FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

-- Fase 3: planos de tratamento
CREATE TABLE IF NOT EXISTS public.treatment_plans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  name text NOT NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  sessions_total int NOT NULL DEFAULT 1,
  sessions_used int NOT NULL DEFAULT 0,
  payment_policy text
    CHECK (payment_policy IS NULL OR payment_policy IN ('antecipado', 'parcelado', 'por_sessao')),
  status text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'concluido', 'cancelado')),
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient ON public.treatment_plans(patient_id);

ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "treatment_plans_clinic"
  ON public.treatment_plans FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS treatment_plan_id uuid REFERENCES public.treatment_plans(id) ON DELETE SET NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS session_number int;

-- Fase 4: campos customizados de produto
CREATE TABLE IF NOT EXISTS public.product_field_definitions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  slug text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text'
    CHECK (field_type IN ('text', 'number', 'date', 'boolean')),
  required_for_lot boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (clinic_id, slug)
);

ALTER TABLE public.product_field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_field_definitions_clinic"
  ON public.product_field_definitions FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.product_field_values (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.product_field_definitions(id) ON DELETE CASCADE,
  value text,
  UNIQUE (product_id, field_id)
);

ALTER TABLE public.product_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_field_values_clinic"
  ON public.product_field_values FOR ALL
  USING (
    product_id IN (
      SELECT id FROM public.products
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    product_id IN (
      SELECT id FROM public.products
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Fase 4: lotes de estoque
CREATE TABLE IF NOT EXISTS public.stock_lots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  lot_code text NOT NULL,
  expiry_date date,
  quantity_on_hand numeric(12,3) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (product_id, lot_code)
);

CREATE INDEX IF NOT EXISTS idx_stock_lots_product ON public.stock_lots(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_lots_expiry ON public.stock_lots(expiry_date);

ALTER TABLE public.stock_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_lots_clinic"
  ON public.stock_lots FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS stock_lot_id uuid REFERENCES public.stock_lots(id) ON DELETE SET NULL;
