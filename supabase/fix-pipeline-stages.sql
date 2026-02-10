-- Fix: Atualizar stages antigos e constraint do pipeline
-- Execute no SQL Editor do Supabase

-- 1. Atualizar registros com stages antigos para stages válidos
UPDATE public.non_registered_pipeline
SET stage = CASE
  WHEN stage = 'registrado' THEN 'cadastrado'
  WHEN stage = 'arquivado' THEN 'novo_contato'
  ELSE stage
END
WHERE stage IN ('registrado', 'arquivado');

-- 2. Remover constraint antiga se existir
ALTER TABLE public.non_registered_pipeline
  DROP CONSTRAINT IF EXISTS non_registered_pipeline_stage_check;

-- 3. Adicionar constraint nova com stages corretos
ALTER TABLE public.non_registered_pipeline
  ADD CONSTRAINT non_registered_pipeline_stage_check 
  CHECK (stage IN ('novo_contato', 'aguardando_retorno', 'cadastrado', 'agendado'));
