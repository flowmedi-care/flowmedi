-- Corrige acesso público às logos para formulários públicos
-- Execute no Supabase: SQL Editor → New query → Cole → Run.

-- IMPORTANTE: Primeiro, vá ao Dashboard do Supabase → Storage → Buckets → 'logos'
-- e marque manualmente como "Public" se ainda não estiver.

-- 1. Garantir que o bucket 'logos' seja público
UPDATE storage.buckets
SET public = true
WHERE id = 'logos';

-- 2. Remover todas as políticas antigas de leitura se existirem
DROP POLICY IF EXISTS "Logo read public" ON storage.objects;
DROP POLICY IF EXISTS "Public logo access" ON storage.objects;
DROP POLICY IF EXISTS "Anonymous logo read" ON storage.objects;

-- 3. Criar política que permite acesso público (incluindo anônimo) para leitura
-- Esta política permite que qualquer pessoa (incluindo usuários não autenticados) leia logos
-- IMPORTANTE: Não usar auth.uid() aqui, pois isso bloqueia usuários anônimos
CREATE POLICY "Anonymous logo read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'logos' AND
    (name LIKE 'clinic-%' OR name LIKE 'doctor-%')
  );

-- 4. Verificar se o bucket está realmente público
-- Execute esta query para verificar:
-- SELECT id, name, public FROM storage.buckets WHERE id = 'logos';
-- O campo 'public' deve ser 'true'

-- Nota: Se ainda houver problemas após executar este script:
-- 1. Verifique no Dashboard: Storage → Buckets → 'logos' → deve estar marcado como "Public"
-- 2. Verifique se as URLs estão usando getPublicUrl() corretamente
-- 3. Teste acessando a URL diretamente no navegador (deve funcionar sem autenticação)
-- 4. Verifique os logs do Supabase para ver qual política está bloqueando o acesso
