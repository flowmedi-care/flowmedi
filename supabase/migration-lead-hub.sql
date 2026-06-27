-- Migration: Hub de Leads — repescagem e metadados do pipeline
-- Execute no SQL Editor do Supabase

-- ========== EXTENSÕES NO PIPELINE ==========
ALTER TABLE public.non_registered_pipeline
  ADD COLUMN IF NOT EXISTS loss_reason text;

ALTER TABLE public.non_registered_pipeline
  ADD COLUMN IF NOT EXISTS lead_segment text
    CHECK (
      lead_segment IS NULL
      OR lead_segment IN ('captacao', 'nao_fechou', 'pendente_retorno', 'concluido')
    );

ALTER TABLE public.non_registered_pipeline
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'form'
    CHECK (
      source IS NULL
      OR source IN ('form', 'site', 'manual', 'whatsapp')
    );

COMMENT ON COLUMN public.non_registered_pipeline.loss_reason IS 'Motivo de não conversão do lead';
COMMENT ON COLUMN public.non_registered_pipeline.lead_segment IS 'Segmento manual ou derivado no hub de leads';
COMMENT ON COLUMN public.non_registered_pipeline.source IS 'Origem do lead: form, site, manual, whatsapp';

-- ========== TABELA DE REPESCAGEM ==========
CREATE TABLE IF NOT EXISTS public.lead_repescagem (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('captacao', 'falta', 'cancelamento', 'manual')),
  status text NOT NULL DEFAULT 'sugerido'
    CHECK (status IN ('sugerido', 'ativo', 'arquivado')),
  loss_reason text,
  notes text,
  qualified_at timestamptz,
  qualified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_repescagem_clinic ON public.lead_repescagem(clinic_id);
CREATE INDEX IF NOT EXISTS idx_lead_repescagem_patient ON public.lead_repescagem(patient_id);
CREATE INDEX IF NOT EXISTS idx_lead_repescagem_status ON public.lead_repescagem(status);
CREATE INDEX IF NOT EXISTS idx_lead_repescagem_created ON public.lead_repescagem(created_at DESC);

-- ========== RLS ==========
ALTER TABLE public.lead_repescagem ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "repescagem_select_clinic" ON public.lead_repescagem;
DROP POLICY IF EXISTS "repescagem_insert_clinic" ON public.lead_repescagem;
DROP POLICY IF EXISTS "repescagem_update_clinic" ON public.lead_repescagem;

CREATE POLICY "repescagem_select_clinic"
  ON public.lead_repescagem FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND active = true
    )
  );

CREATE POLICY "repescagem_insert_clinic"
  ON public.lead_repescagem FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND active = true
    )
  );

CREATE POLICY "repescagem_update_clinic"
  ON public.lead_repescagem FOR UPDATE
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND active = true
    )
  );

-- ========== TRIGGER updated_at ==========
CREATE OR REPLACE FUNCTION update_lead_repescagem_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_lead_repescagem_updated_at ON public.lead_repescagem;
CREATE TRIGGER trigger_update_lead_repescagem_updated_at
  BEFORE UPDATE ON public.lead_repescagem
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_repescagem_updated_at();

COMMENT ON TABLE public.lead_repescagem IS 'Oportunidades de repescagem para pacientes cadastrados (faltas, cancelamentos, etc.)';
