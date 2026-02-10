-- Torna o bucket 'logos' público para que as imagens sejam acessíveis sem autenticação
-- Execute no Supabase: SQL Editor → New query → Cole → Run.
-- IMPORTANTE: Isso torna todas as logos públicas. Se preferir manter privado,
-- você precisará usar signed URLs (mais complexo).

-- Atualiza o bucket para ser público
UPDATE storage.buckets
SET public = true
WHERE id = 'logos';

-- Se o bucket não existir, você precisa criá-lo manualmente no Dashboard primeiro
-- Storage → Create bucket → Nome: 'logos' → Public: true
