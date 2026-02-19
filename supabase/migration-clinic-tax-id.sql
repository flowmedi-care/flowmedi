-- FlowMedi — Migration: Adicionar campo para CPF/CNPJ da clínica
-- Execute no SQL Editor do Supabase se quiser armazenar CPF/CNPJ localmente
-- Nota: O Stripe já armazena isso no customer object, mas podemos guardar aqui também para facilitar

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS tax_id_type text CHECK (tax_id_type IS NULL OR tax_id_type IN ('cpf', 'cnpj'));

COMMENT ON COLUMN public.clinics.tax_id IS 'CPF ou CNPJ da clínica coletado durante o checkout Stripe';
COMMENT ON COLUMN public.clinics.tax_id_type IS 'Tipo do ID fiscal: cpf ou cnpj';
