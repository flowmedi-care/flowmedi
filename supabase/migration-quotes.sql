-- Orçamentos comerciais (propostas antes da comanda)

CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  quote_number integer NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  pipeline_id uuid REFERENCES public.non_registered_pipeline(id) ON DELETE SET NULL,
  recipient_name text,
  recipient_phone text,
  recipient_email text,
  professional_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'enviado', 'aceito', 'recusado', 'expirado')),
  valid_until date,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  terms text,
  sent_at timestamptz,
  accepted_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (clinic_id, quote_number),
  CHECK (
    patient_id IS NOT NULL
    OR pipeline_id IS NOT NULL
    OR (recipient_name IS NOT NULL AND length(trim(recipient_name)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_quotes_clinic ON public.quotes(clinic_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_patient ON public.quotes(patient_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created ON public.quotes(created_at DESC);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_clinic"
  ON public.quotes FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.quote_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('service', 'product', 'procedure', 'other')),
  reference_id uuid,
  description text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  total_price numeric(12,2) NOT NULL DEFAULT 0,
  section text NOT NULL DEFAULT 'services'
    CHECK (section IN ('services', 'materials', 'other')),
  bill_separately boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON public.quote_items(quote_id);

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_items_clinic"
  ON public.quote_items FOR ALL
  USING (
    quote_id IN (
      SELECT id FROM public.quotes
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    quote_id IN (
      SELECT id FROM public.quotes
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
  );

COMMENT ON TABLE public.quotes IS 'Orçamentos comerciais — propostas enviadas ao paciente/lead antes da comanda.';
COMMENT ON TABLE public.quote_items IS 'Itens do orçamento: serviços, materiais e outros valores.';
