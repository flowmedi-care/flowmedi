-- Bucket para mídia do WhatsApp (imagens, áudios, etc.)
-- Execute no SQL Editor do Supabase
--
-- IMPORTANTE: Crie o bucket manualmente primeiro no Dashboard:
--   Storage → Create bucket → Nome: whatsapp-media → Public: true
--   File size limit: 50MB
--   Allowed MIME: image/*, audio/*, video/*, application/pdf
--
-- Depois execute o restante desta migration (políticas):

-- Política: service role pode inserir (webhook usa service role)
DROP POLICY IF EXISTS "WhatsApp media service insert" ON storage.objects;
CREATE POLICY "WhatsApp media service insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'whatsapp-media');

-- Política: leitura pública (bucket é público)
DROP POLICY IF EXISTS "WhatsApp media public read" ON storage.objects;
CREATE POLICY "WhatsApp media public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'whatsapp-media');
