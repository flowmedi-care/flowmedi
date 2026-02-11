-- Adicionar limites customizados por clínica (para free pass Pro com restrições)
-- Execute no SQL Editor do Supabase

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS max_doctors_custom int,
  ADD COLUMN IF NOT EXISTS max_secretaries_custom int;

COMMENT ON COLUMN public.clinics.max_doctors_custom IS 'Limite customizado de médicos para esta clínica. Se definido, sobrescreve o limite do plano. NULL = usar limite do plano.';
COMMENT ON COLUMN public.clinics.max_secretaries_custom IS 'Limite customizado de secretários para esta clínica. Se definido, sobrescreve o limite do plano. NULL = usar limite do plano.';

-- Índice para performance (opcional)
CREATE INDEX IF NOT EXISTS idx_clinics_custom_limits ON public.clinics(max_doctors_custom, max_secretaries_custom) 
WHERE max_doctors_custom IS NOT NULL OR max_secretaries_custom IS NOT NULL;
