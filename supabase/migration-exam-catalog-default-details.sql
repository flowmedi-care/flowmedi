-- Migration: Detalhes padrão no catálogo de exames
ALTER TABLE public.clinical_exam_catalog
  ADD COLUMN IF NOT EXISTS default_details text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.clinical_exam_catalog.default_details IS 'Texto padrão do que solicitar neste exame (ex.: parâmetros do hemograma, jejum)';
