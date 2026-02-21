-- Migration: Link de divulgação por médico (referral)
-- Paciente clica no link do médico → abre WhatsApp da clínica com mensagem pré-preenchida
-- Sistema identifica o código na primeira mensagem e vincula à secretária do médico
--
-- Execute após: migration-eventos-consultas-full.sql (secretary_doctors)

CREATE TABLE IF NOT EXISTS public.doctor_referral_codes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, code)
);

COMMENT ON TABLE public.doctor_referral_codes IS 'Código único por médico para link de divulgação. Ao clicar, paciente abre WhatsApp com mensagem que contém o código; sistema vincula à secretária do médico.';
CREATE INDEX IF NOT EXISTS idx_doctor_referral_codes_clinic ON public.doctor_referral_codes(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctor_referral_codes_doctor ON public.doctor_referral_codes(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_referral_codes_code ON public.doctor_referral_codes(clinic_id, code);

ALTER TABLE public.doctor_referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doctor_referral_codes_clinic_access" ON public.doctor_referral_codes;
CREATE POLICY "doctor_referral_codes_clinic_access"
  ON public.doctor_referral_codes FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));
