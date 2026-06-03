-- Hub operacional: procedimentos vinculados a serviços/insumos, estoque, atendimento, comandas e financeiro

-- ========== PROCEDURES: serviço e tipo de consulta padrão ==========
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS default_service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_appointment_type_id uuid REFERENCES public.appointment_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_procedures_default_service ON public.procedures(default_service_id);

COMMENT ON COLUMN public.procedures.default_service_id IS 'Serviço de cobrança sugerido ao agendar este procedimento';
COMMENT ON COLUMN public.procedures.default_appointment_type_id IS 'Tipo de consulta sugerido (duração/slot)';

-- ========== PRODUCTS (insumos/materiais) ==========
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  unit text NOT NULL DEFAULT 'un',
  cost numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2),
  expiry_tracked boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_clinic ON public.products(clinic_id);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_clinic"
  ON public.products FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

-- ========== BOM: procedimento -> produtos ==========
CREATE TABLE IF NOT EXISTS public.procedure_products (
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_per_procedure numeric(12,3) NOT NULL DEFAULT 1,
  PRIMARY KEY (procedure_id, product_id)
);

ALTER TABLE public.procedure_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "procedure_products_clinic"
  ON public.procedure_products FOR ALL
  USING (
    procedure_id IN (
      SELECT id FROM public.procedures
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    procedure_id IN (
      SELECT id FROM public.procedures
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
    AND product_id IN (
      SELECT id FROM public.products
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- ========== N:N consulta <-> procedimentos ==========
CREATE TABLE IF NOT EXISTS public.appointment_procedures (
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (appointment_id, procedure_id)
);

CREATE INDEX IF NOT EXISTS idx_appointment_procedures_appointment ON public.appointment_procedures(appointment_id);

ALTER TABLE public.appointment_procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointment_procedures_clinic"
  ON public.appointment_procedures FOR ALL
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
    AND procedure_id IN (
      SELECT id FROM public.procedures
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
  );

INSERT INTO public.appointment_procedures (appointment_id, procedure_id, sort_order)
SELECT id, procedure_id, 0
FROM public.appointments
WHERE procedure_id IS NOT NULL
ON CONFLICT (appointment_id, procedure_id) DO NOTHING;

-- ========== ENCOUNTERS (atendimento clínico) ==========
CREATE TABLE IF NOT EXISTS public.encounters (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'em_andamento'
    CHECK (status IN ('em_andamento', 'finalizado_aguardando_cobranca', 'cobrado')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encounters_appointment ON public.encounters(appointment_id);
CREATE INDEX IF NOT EXISTS idx_encounters_clinic ON public.encounters(clinic_id);

ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "encounters_clinic"
  ON public.encounters FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

-- ========== CONSUMO DE MATERIAL (stand-by até cobrança) ==========
CREATE TABLE IF NOT EXISTS public.appointment_consumption_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'procedure_default'
    CHECK (source IN ('procedure_default', 'manual_add', 'manual_remove')),
  locked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consumption_appointment ON public.appointment_consumption_lines(appointment_id);

ALTER TABLE public.appointment_consumption_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consumption_clinic"
  ON public.appointment_consumption_lines FOR ALL
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

-- ========== ESTOQUE ==========
CREATE TABLE IF NOT EXISTS public.stock_balances (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  quantity_on_hand numeric(12,3) NOT NULL DEFAULT 0,
  quantity_committed numeric(12,3) NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_balances_clinic"
  ON public.stock_balances FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  movement_type text NOT NULL
    CHECK (movement_type IN ('adjustment', 'committed', 'released', 'consumed')),
  quantity numeric(12,3) NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_appointment ON public.stock_movements(appointment_id);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_movements_clinic"
  ON public.stock_movements FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

-- ========== COMANDAS E PAGAMENTOS ==========
CREATE TABLE IF NOT EXISTS public.comandas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  encounter_id uuid REFERENCES public.encounters(id) ON DELETE SET NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'parcial', 'paga', 'cancelada')),
  notes text,
  closed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_comandas_appointment ON public.comandas(appointment_id);
CREATE INDEX IF NOT EXISTS idx_comandas_patient ON public.comandas(patient_id);

ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comandas_clinic"
  ON public.comandas FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.comanda_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  comanda_id uuid NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('service', 'procedure', 'product', 'other')),
  description text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  total_price numeric(12,2) NOT NULL DEFAULT 0,
  reference_id uuid
);

ALTER TABLE public.comanda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comanda_items_clinic"
  ON public.comanda_items FOR ALL
  USING (
    comanda_id IN (
      SELECT id FROM public.comandas
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    comanda_id IN (
      SELECT id FROM public.comandas
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE TABLE IF NOT EXISTS public.patient_payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  comanda_id uuid NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  payment_method text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.patient_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_payments_clinic"
  ON public.patient_payments FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

-- ========== FINANCEIRO OPERACIONAL ==========
CREATE TABLE IF NOT EXISTS public.financial_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  entry_type text NOT NULL CHECK (entry_type IN ('receita', 'despesa')),
  origin text NOT NULL CHECK (origin IN ('patient', 'supplier', 'manual', 'stock')),
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  due_date date,
  paid_at timestamptz,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'pago', 'cancelado')),
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  comanda_id uuid REFERENCES public.comandas(id) ON DELETE SET NULL,
  supplier_name text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_financial_entries_clinic ON public.financial_entries(clinic_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_due ON public.financial_entries(due_date);

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_entries_clinic"
  ON public.financial_entries FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

-- Foto do paciente (perfil)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS photo_url text;

COMMENT ON COLUMN public.patients.photo_url IS 'URL da foto do paciente no storage';
