-- Debug: lifecycle_stage / stage checks em non_registered_pipeline
-- Cole no SQL Editor do Supabase e rode bloco a bloco.
-- Objetivo: ver por que em_qualificacao / cliente / perdido falham no DnD.

-- 1) Constraints atuais na tabela
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

-- 2) Distribuição atual (lifecycle vs stage legado)
SELECT
  lifecycle_stage,
  stage,
  count(*) AS n
FROM public.non_registered_pipeline
GROUP BY 1, 2
ORDER BY 1 NULLS FIRST, 2;

-- 2b) Pares dessincronizados (lifecycle vs stage legado esperado)
SELECT id, name, email, lifecycle_stage, stage
FROM public.non_registered_pipeline
WHERE
  (lifecycle_stage = 'lead_novo' AND stage IS DISTINCT FROM 'novo_contato')
  OR (lifecycle_stage IN ('em_qualificacao', 'perdido') AND stage IS DISTINCT FROM 'aguardando_retorno')
  OR (lifecycle_stage = 'qualificado' AND stage IS DISTINCT FROM 'cadastrado')
  OR (lifecycle_stage IN ('oportunidade', 'cliente') AND stage IS DISTINCT FROM 'agendado');

-- Opcional: corrigir dessync (rode só se 2b retornar linhas)
-- UPDATE public.non_registered_pipeline
-- SET stage = CASE lifecycle_stage
--   WHEN 'lead_novo' THEN 'novo_contato'
--   WHEN 'em_qualificacao' THEN 'aguardando_retorno'
--   WHEN 'perdido' THEN 'aguardando_retorno'
--   WHEN 'qualificado' THEN 'cadastrado'
--   WHEN 'oportunidade' THEN 'agendado'
--   WHEN 'cliente' THEN 'agendado'
--   ELSE stage
-- END
-- WHERE lifecycle_stage IS NOT NULL
--   AND (
--     (lifecycle_stage = 'lead_novo' AND stage IS DISTINCT FROM 'novo_contato')
--     OR (lifecycle_stage IN ('em_qualificacao', 'perdido') AND stage IS DISTINCT FROM 'aguardando_retorno')
--     OR (lifecycle_stage = 'qualificado' AND stage IS DISTINCT FROM 'cadastrado')
--     OR (lifecycle_stage IN ('oportunidade', 'cliente') AND stage IS DISTINCT FROM 'agendado')
--   );

-- 3) Valores inválidos (fora do CHECK esperado)
SELECT id, name, email, lifecycle_stage, stage, loss_reason, updated_at
FROM public.non_registered_pipeline
WHERE lifecycle_stage IS NOT NULL
  AND lifecycle_stage NOT IN (
    'lead_novo',
    'em_qualificacao',
    'qualificado',
    'oportunidade',
    'cliente',
    'perdido'
  );

SELECT id, name, email, lifecycle_stage, stage
FROM public.non_registered_pipeline
WHERE stage IS NOT NULL
  AND stage NOT IN (
    'novo_contato',
    'aguardando_retorno',
    'cadastrado',
    'agendado'
  );

-- 4) Teste de UPDATE (NÃO comita — rode em transação e faça ROLLBACK)
-- Troque o UUID por um lead real do bloco 2.
BEGIN;

-- Pegue um id de exemplo:
-- SELECT id, lifecycle_stage, stage FROM public.non_registered_pipeline LIMIT 5;

-- UPDATE de teste (substitua :id):
-- UPDATE public.non_registered_pipeline
-- SET lifecycle_stage = 'em_qualificacao',
--     stage = 'aguardando_retorno',
--     loss_reason = NULL
-- WHERE id = 'COLE-UUID-AQUI'
-- RETURNING id, lifecycle_stage, stage;

-- UPDATE public.non_registered_pipeline
-- SET lifecycle_stage = 'cliente',
--     stage = 'agendado',
--     loss_reason = NULL
-- WHERE id = 'COLE-UUID-AQUI'
-- RETURNING id, lifecycle_stage, stage;

-- UPDATE public.non_registered_pipeline
-- SET lifecycle_stage = 'perdido',
--     stage = 'aguardando_retorno',
--     loss_reason = 'teste_debug'
-- WHERE id = 'COLE-UUID-AQUI'
-- RETURNING id, lifecycle_stage, stage, loss_reason;

ROLLBACK;

-- 5) Se o CHECK de lifecycle estiver errado/ausente, aplique o fix canônico:
--    supabase/fix-lifecycle-stage-check.sql
