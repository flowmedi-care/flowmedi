-- Orçamentos automáticos (IA) + configuração por procedimento

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS quote_default_validity_days integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS quote_default_terms text;

COMMENT ON COLUMN public.clinics.quote_default_validity_days IS 'Validade padrão (dias) de orçamentos gerados pela IA';
COMMENT ON COLUMN public.clinics.quote_default_terms IS 'Condições padrão exibidas nos orçamentos automáticos';

CREATE TABLE IF NOT EXISTS public.procedure_quote_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  pricing_mode text NOT NULL DEFAULT 'per_doctor'
    CHECK (pricing_mode IN ('clinic_general', 'per_doctor')),
  default_service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  default_professional_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, procedure_id)
);

CREATE INDEX IF NOT EXISTS idx_procedure_quote_settings_clinic
  ON public.procedure_quote_settings(clinic_id);

ALTER TABLE public.procedure_quote_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "procedure_quote_settings_clinic" ON public.procedure_quote_settings;
CREATE POLICY "procedure_quote_settings_clinic"
  ON public.procedure_quote_settings FOR ALL
  USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );
