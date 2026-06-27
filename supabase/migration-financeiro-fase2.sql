-- FINANCEIRO FASE 2 — recorrência, DRE completa, estoque integrado

-- Expand category check on financial_entries
ALTER TABLE public.financial_entries DROP CONSTRAINT IF EXISTS financial_entries_category_check;
ALTER TABLE public.financial_entries
  ADD CONSTRAINT financial_entries_category_check
  CHECK (category IS NULL OR category IN (
    'aluguel', 'salarios', 'materiais', 'laboratorio', 'equipamentos',
    'marketing', 'taxas_bancarias', 'depreciacao', 'pecld', 'impostos',
    'financeiras', 'outros'
  ));

ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS series_id uuid,
  ADD COLUMN IF NOT EXISTS series_index int,
  ADD COLUMN IF NOT EXISTS competence_date date,
  ADD COLUMN IF NOT EXISTS dre_section text;

CREATE INDEX IF NOT EXISTS idx_financial_entries_series ON public.financial_entries(series_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_competence ON public.financial_entries(clinic_id, competence_date);
CREATE INDEX IF NOT EXISTS idx_financial_entries_paid_at ON public.financial_entries(clinic_id, paid_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_entries_series_due
  ON public.financial_entries(series_id, due_date)
  WHERE series_id IS NOT NULL AND due_date IS NOT NULL;

-- Recurrence series
CREATE TABLE IF NOT EXISTS public.financial_entry_series (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('receita', 'despesa')),
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  category text,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  payment_method text,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  interval_count int NOT NULL DEFAULT 1,
  end_mode text NOT NULL CHECK (end_mode IN ('count', 'until_date', 'never')),
  end_count int,
  end_date date,
  next_due_date date,
  generated_count int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.financial_entry_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financial_entry_series_clinic"
  ON public.financial_entry_series FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

ALTER TABLE public.financial_entries
  ADD CONSTRAINT financial_entries_series_id_fkey
  FOREIGN KEY (series_id) REFERENCES public.financial_entry_series(id) ON DELETE SET NULL;

-- Clinic financial settings (PECLD, IR/CSLL)
CREATE TABLE IF NOT EXISTS public.clinic_financial_settings (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  pecld_percent_ar numeric(5,2) NOT NULL DEFAULT 2.00,
  ir_csll_percent_lair numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.clinic_financial_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinic_financial_settings_clinic"
  ON public.clinic_financial_settings FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

-- Expense receipts (internal, non-fiscal)
CREATE TABLE IF NOT EXISTS public.expense_receipts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  financial_entry_id uuid NOT NULL REFERENCES public.financial_entries(id) ON DELETE CASCADE,
  receipt_number text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_receipts_entry ON public.expense_receipts(financial_entry_id);
ALTER TABLE public.expense_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expense_receipts_clinic"
  ON public.expense_receipts FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

-- Stock categories
CREATE TABLE IF NOT EXISTS public.stock_categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  icon text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (clinic_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_stock_categories_clinic ON public.stock_categories(clinic_id);
ALTER TABLE public.stock_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_categories_clinic"
  ON public.stock_categories FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

-- Product extensions
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.stock_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS track_lot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS track_expiry boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_quantity numeric(12,3) DEFAULT 0;

ALTER TABLE public.product_field_definitions
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.stock_categories(id) ON DELETE CASCADE;

-- Financial entry stock lines (expense → stock integration)
CREATE TABLE IF NOT EXISTS public.financial_entry_stock_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  financial_entry_id uuid NOT NULL REFERENCES public.financial_entries(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity numeric(12,3) NOT NULL,
  unit_cost numeric(12,2) NOT NULL,
  lot_code text,
  expiry_date date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fesl_entry ON public.financial_entry_stock_lines(financial_entry_id);
ALTER TABLE public.financial_entry_stock_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financial_entry_stock_lines_clinic"
  ON public.financial_entry_stock_lines FOR ALL
  USING (
    financial_entry_id IN (
      SELECT id FROM public.financial_entries
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    financial_entry_id IN (
      SELECT id FROM public.financial_entries
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;
