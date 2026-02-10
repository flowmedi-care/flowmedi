-- Adiciona campo para ajustar escala das logos
-- Execute no SQL Editor do Supabase

-- Escala da logo da clínica (padrão: 100 = 100%)
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS logo_scale integer DEFAULT 100 CHECK (logo_scale >= 50 AND logo_scale <= 200);

-- Escala da logo do médico (padrão: 100 = 100%)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS logo_scale integer DEFAULT 100 CHECK (logo_scale >= 50 AND logo_scale <= 200);
