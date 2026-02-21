-- Migration: Link de divulgação por médico (referral)
-- Paciente clica no link do médico → abre WhatsApp da clínica com mensagem pré-preenchida
-- Sistema identifica pela mensagem customizada e vincula à secretária do médico
--
-- Execute após: migration-eventos-consultas-full.sql (secretary_doctors)

CREATE TABLE IF NOT EXISTS public.doctor_referral_codes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  custom_message text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, doctor_id)
);

COMMENT ON TABLE public.doctor_referral_codes IS 'Mensagem personalizada por médico para link de divulgação. Paciente envia a mensagem; sistema faz match e vincula à secretária do médico.';
CREATE INDEX IF NOT EXISTS idx_doctor_referral_codes_clinic ON public.doctor_referral_codes(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctor_referral_codes_doctor ON public.doctor_referral_codes(doctor_id);

ALTER TABLE public.doctor_referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doctor_referral_codes_clinic_access" ON public.doctor_referral_codes;
CREATE POLICY "doctor_referral_codes_clinic_access"
  ON public.doctor_referral_codes FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));
