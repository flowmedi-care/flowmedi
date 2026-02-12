-- Procedimentos (ex.: endoscopia): nome + recomendações padrão
-- Associação many-to-many: formulários <-> procedimentos (no formulário: "Procedimentos que usam este formulário")
-- Consulta pode ter procedure_id para pré-preencher recomendações e auto-associar formulários

-- ========== TABELA PROCEDURES ==========
CREATE TABLE IF NOT EXISTS public.procedures (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  recommendations text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procedures_clinic_id ON public.procedures(clinic_id);

ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "procedures_clinic"
  ON public.procedures
  FOR ALL
  USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

-- ========== ASSOCIAÇÃO FORM_TEMPLATE <-> PROCEDURES (many-to-many) ==========
CREATE TABLE IF NOT EXISTS public.form_template_procedures (
  form_template_id uuid NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  PRIMARY KEY (form_template_id, procedure_id)
);

CREATE INDEX IF NOT EXISTS idx_ftp_form ON public.form_template_procedures(form_template_id);
CREATE INDEX IF NOT EXISTS idx_ftp_procedure ON public.form_template_procedures(procedure_id);

ALTER TABLE public.form_template_procedures ENABLE ROW LEVEL SECURITY;

-- Usuário da clínica pode gerenciar vínculos dos formulários da própria clínica
CREATE POLICY "form_template_procedures_via_template"
  ON public.form_template_procedures
  FOR ALL
  USING (
    form_template_id IN (
      SELECT id FROM public.form_templates
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    form_template_id IN (
      SELECT id FROM public.form_templates
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
    AND procedure_id IN (
      SELECT id FROM public.procedures
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- ========== APPOINTMENTS: procedure_id ==========
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS procedure_id uuid REFERENCES public.procedures(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_procedure_id ON public.appointments(procedure_id);

COMMENT ON COLUMN public.appointments.procedure_id IS 'Procedimento (ex.: endoscopia); usado para pré-preencher recomendações e auto-associar formulários';
