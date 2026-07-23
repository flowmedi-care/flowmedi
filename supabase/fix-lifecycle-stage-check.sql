-- Fix: CHECK de lifecycle_stage em non_registered_pipeline
-- Execute no SQL Editor do Supabase.
--
-- Contexto: migration-crm-lifecycle.sql usa
--   ADD COLUMN IF NOT EXISTS ... CHECK (...)
-- Isso NÃO atualiza um CHECK antigo/incompleto se a coluna já existia.
-- Resultado: DnD para em_qualificacao / cliente / perdido falha com
-- "violate constraint", e o Kanban reverte o card.

-- =============================================================================
-- 1) Inspecionar constraints atuais (opcional — rode antes do fix)
-- =============================================================================
SELECT
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'non_registered_pipeline'
  AND con.contype = 'c'
ORDER BY con.conname;

-- =============================================================================
-- 2) Recriar CHECK de lifecycle_stage (6 valores do funil + NULL)
-- =============================================================================
ALTER TABLE public.non_registered_pipeline
  DROP CONSTRAINT IF EXISTS non_registered_pipeline_lifecycle_stage_check;

ALTER TABLE public.non_registered_pipeline
  ADD CONSTRAINT non_registered_pipeline_lifecycle_stage_check
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

-- =============================================================================
-- 3) Garantir CHECK do stage legado (necessário para o mapeamento do DnD)
-- =============================================================================
ALTER TABLE public.non_registered_pipeline
  DROP CONSTRAINT IF EXISTS non_registered_pipeline_stage_check;

ALTER TABLE public.non_registered_pipeline
  ADD CONSTRAINT non_registered_pipeline_stage_check
  CHECK (stage IN ('novo_contato', 'aguardando_retorno', 'cadastrado', 'agendado'));

-- =============================================================================
-- 4) Corrigir pares dessincronizados (lifecycle vs stage legado)
-- =============================================================================
UPDATE public.non_registered_pipeline
SET stage = CASE lifecycle_stage
  WHEN 'lead_novo' THEN 'novo_contato'
  WHEN 'em_qualificacao' THEN 'aguardando_retorno'
  WHEN 'perdido' THEN 'aguardando_retorno'
  WHEN 'qualificado' THEN 'cadastrado'
  WHEN 'oportunidade' THEN 'agendado'
  WHEN 'cliente' THEN 'agendado'
  ELSE stage
END
WHERE lifecycle_stage IS NOT NULL
  AND (
    (lifecycle_stage = 'lead_novo' AND stage IS DISTINCT FROM 'novo_contato')
    OR (lifecycle_stage IN ('em_qualificacao', 'perdido') AND stage IS DISTINCT FROM 'aguardando_retorno')
    OR (lifecycle_stage = 'qualificado' AND stage IS DISTINCT FROM 'cadastrado')
    OR (lifecycle_stage IN ('oportunidade', 'cliente') AND stage IS DISTINCT FROM 'agendado')
  );

-- =============================================================================
-- 5) Verificar após o fix
-- =============================================================================
SELECT
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'non_registered_pipeline'
  AND con.contype = 'c'
  AND con.conname IN (
    'non_registered_pipeline_lifecycle_stage_check',
    'non_registered_pipeline_stage_check'
  )
ORDER BY con.conname;

SELECT lifecycle_stage, stage, count(*) AS n
FROM public.non_registered_pipeline
GROUP BY 1, 2
ORDER BY 1 NULLS FIRST, 2;

-- =============================================================================
-- 6) Teste opcional (NÃO comita — descomente, troque o UUID, rode e faça ROLLBACK)
-- =============================================================================
-- BEGIN;
-- UPDATE public.non_registered_pipeline
-- SET lifecycle_stage = 'em_qualificacao', stage = 'aguardando_retorno', loss_reason = NULL
-- WHERE id = 'COLE-UUID-AQUI'
-- RETURNING id, lifecycle_stage, stage;
--
-- UPDATE public.non_registered_pipeline
-- SET lifecycle_stage = 'cliente', stage = 'agendado', loss_reason = NULL
-- WHERE id = 'COLE-UUID-AQUI'
-- RETURNING id, lifecycle_stage, stage;
--
-- UPDATE public.non_registered_pipeline
-- SET lifecycle_stage = 'perdido', stage = 'aguardando_retorno', loss_reason = 'teste_debug'
-- WHERE id = 'COLE-UUID-AQUI'
-- RETURNING id, lifecycle_stage, stage, loss_reason;
-- ROLLBACK;
