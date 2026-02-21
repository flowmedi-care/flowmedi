-- Migration: patient_secretary - Associação explícita paciente ↔ secretária
-- Quando preenchida: somente a secretária vê eventos desse paciente.
-- Preenchida automaticamente ao: (1) atribuir conversa WhatsApp + paciente vinculado, (2) secretária agenda primeira consulta.
--
-- Execute após: migration-eventos-consultas-full.sql (secretary_doctors)

CREATE TABLE IF NOT EXISTS public.patient_secretary (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  secretary_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, patient_id)
);

COMMENT ON TABLE public.patient_secretary IS 'Associação paciente ↔ secretária. Uma secretária por paciente. Preenchida ao atribuir conversa WhatsApp com paciente vinculado ou ao secretária agendar primeira consulta.';
CREATE INDEX IF NOT EXISTS idx_patient_secretary_clinic ON public.patient_secretary(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_secretary_secretary ON public.patient_secretary(secretary_id);
CREATE INDEX IF NOT EXISTS idx_patient_secretary_patient ON public.patient_secretary(patient_id);

ALTER TABLE public.patient_secretary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_secretary_clinic_access" ON public.patient_secretary;
CREATE POLICY "patient_secretary_clinic_access"
  ON public.patient_secretary FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));
