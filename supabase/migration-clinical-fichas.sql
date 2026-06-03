-- Fichas de atendimento clínico (sidebar configurável por procedimento)

CREATE TABLE IF NOT EXISTS public.clinical_ficha_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  ficha_type text NOT NULL DEFAULT 'fields'
    CHECK (ficha_type IN ('fields', 'prescription', 'exam_request', 'notes')),
  definition jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (clinic_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_clinical_ficha_templates_clinic ON public.clinical_ficha_templates(clinic_id);

ALTER TABLE public.clinical_ficha_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinical_ficha_templates_clinic"
  ON public.clinical_ficha_templates FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.procedure_clinical_fichas (
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  ficha_template_id uuid NOT NULL REFERENCES public.clinical_ficha_templates(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (procedure_id, ficha_template_id)
);

CREATE INDEX IF NOT EXISTS idx_procedure_clinical_fichas_ficha ON public.procedure_clinical_fichas(ficha_template_id);

ALTER TABLE public.procedure_clinical_fichas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "procedure_clinical_fichas_clinic"
  ON public.procedure_clinical_fichas FOR ALL
  USING (
    procedure_id IN (
      SELECT id FROM public.procedures WHERE clinic_id IN (
        SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    procedure_id IN (
      SELECT id FROM public.procedures WHERE clinic_id IN (
        SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

CREATE TABLE IF NOT EXISTS public.appointment_ficha_instances (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  ficha_template_id uuid NOT NULL REFERENCES public.clinical_ficha_templates(id) ON DELETE CASCADE,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'concluida')),
  filled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (appointment_id, ficha_template_id)
);

CREATE INDEX IF NOT EXISTS idx_appointment_ficha_instances_appt ON public.appointment_ficha_instances(appointment_id);

ALTER TABLE public.appointment_ficha_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointment_ficha_instances_clinic"
  ON public.appointment_ficha_instances FOR ALL
  USING (
    appointment_id IN (
      SELECT id FROM public.appointments WHERE clinic_id IN (
        SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    appointment_id IN (
      SELECT id FROM public.appointments WHERE clinic_id IN (
        SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- Seed fichas padrão por clínica (idempotente)
INSERT INTO public.clinical_ficha_templates (clinic_id, name, slug, ficha_type, definition, display_order, is_system, active)
SELECT
  c.id,
  v.name,
  v.slug,
  v.ficha_type,
  v.definition::jsonb,
  v.display_order,
  true,
  true
FROM public.clinics c
CROSS JOIN (
  VALUES
    (
      'Anamnese',
      'anamnese',
      'fields',
      '[{"id":"anamnese-queixa","type":"long_text","label":"Queixa principal","required":true},{"id":"anamnese-hda","type":"long_text","label":"História da doença atual"},{"id":"anamnese-antec","type":"long_text","label":"Antecedentes pessoais"}]',
      1
    ),
    (
      'Evolução',
      'evolucao',
      'fields',
      '[{"id":"evolucao-texto","type":"long_text","label":"Evolução do atendimento","required":true}]',
      2
    ),
    ('Receita', 'receita', 'prescription', '[]', 3),
    ('Pedido de exame', 'pedido-exame', 'exam_request', '[]', 4),
    (
      'Atestado',
      'atestado',
      'fields',
      '[{"id":"atestado-texto","type":"long_text","label":"Texto do atestado","required":true},{"id":"atestado-dias","type":"number","label":"Dias de afastamento","min":1}]',
      5
    )
) AS v(name, slug, ficha_type, definition, display_order)
ON CONFLICT (clinic_id, slug) DO NOTHING;

-- Vincular fichas padrão a todos os procedimentos existentes
INSERT INTO public.procedure_clinical_fichas (procedure_id, ficha_template_id, sort_order)
SELECT p.id, ft.id, ft.display_order
FROM public.procedures p
JOIN public.clinical_ficha_templates ft ON ft.clinic_id = p.clinic_id AND ft.is_system = true
ON CONFLICT (procedure_id, ficha_template_id) DO NOTHING;

COMMENT ON TABLE public.clinical_ficha_templates IS 'Templates de fichas clínicas exibidas na sidebar do atendimento';
COMMENT ON TABLE public.appointment_ficha_instances IS 'Respostas das fichas preenchidas durante o atendimento';
