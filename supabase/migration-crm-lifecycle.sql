-- Migration: CRM lifecycle stages, scoring e metadados de funil
-- Execute no SQL Editor do Supabase
--
-- Nota: ADD COLUMN IF NOT EXISTS ... CHECK (...) não atualiza um CHECK
-- já existente. Se o DnD rejeitar em_qualificacao/cliente/perdido, rode:
--   supabase/fix-lifecycle-stage-check.sql

ALTER TABLE public.non_registered_pipeline
  ADD COLUMN IF NOT EXISTS lifecycle_stage text
    CHECK (
      lifecycle_stage IS NULL
      OR lifecycle_stage IN (
        'lead_novo',
        'em_qualificacao',
        'qualificado',
        'oportunidade',
        'cliente',
        'perdido'
      )
    );

ALTER TABLE public.non_registered_pipeline
  ADD COLUMN IF NOT EXISTS qualification_type text
    CHECK (qualification_type IS NULL OR qualification_type IN ('mql', 'sql'));

ALTER TABLE public.non_registered_pipeline
  ADD COLUMN IF NOT EXISTS temperature_override text
    CHECK (
      temperature_override IS NULL
      OR temperature_override IN ('frio', 'morno', 'quente')
    );

ALTER TABLE public.non_registered_pipeline
  ADD COLUMN IF NOT EXISTS lead_score int NOT NULL DEFAULT 0;

ALTER TABLE public.non_registered_pipeline
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz;

ALTER TABLE public.non_registered_pipeline
  ADD COLUMN IF NOT EXISTS scored_at timestamptz;

-- Mapear estágios legados para lifecycle
UPDATE public.non_registered_pipeline
SET lifecycle_stage = CASE
  WHEN loss_reason IS NOT NULL AND stage = 'aguardando_retorno' THEN 'perdido'
  WHEN stage = 'novo_contato' THEN 'lead_novo'
  WHEN stage = 'aguardando_retorno' THEN 'em_qualificacao'
  WHEN stage = 'cadastrado' THEN 'qualificado'
  WHEN stage = 'agendado' THEN 'oportunidade'
  ELSE 'lead_novo'
END
WHERE lifecycle_stage IS NULL;

ALTER TABLE public.non_registered_pipeline
  ALTER COLUMN lifecycle_stage SET DEFAULT 'lead_novo';

CREATE INDEX IF NOT EXISTS idx_non_registered_pipeline_lifecycle
  ON public.non_registered_pipeline(lifecycle_stage);

CREATE INDEX IF NOT EXISTS idx_non_registered_pipeline_lead_score
  ON public.non_registered_pipeline(lead_score DESC);

COMMENT ON COLUMN public.non_registered_pipeline.lifecycle_stage IS
  'Etapa do funil CRM: lead_novo, em_qualificacao, qualificado, oportunidade, cliente, perdido';
COMMENT ON COLUMN public.non_registered_pipeline.qualification_type IS 'Subtipo: mql ou sql';
COMMENT ON COLUMN public.non_registered_pipeline.temperature_override IS 'Override manual: frio, morno, quente';
COMMENT ON COLUMN public.non_registered_pipeline.lead_score IS 'Score automático 0-100 para priorização';
COMMENT ON COLUMN public.non_registered_pipeline.next_action_at IS 'Data prevista da próxima ação/follow-up';
