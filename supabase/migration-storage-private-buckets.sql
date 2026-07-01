-- Tornar buckets sensíveis privados e aplicar RLS clinic-scoped.
-- Execute no SQL Editor do Supabase após as migrations que criam os buckets.

-- 1. Buckets privados
UPDATE storage.buckets
SET public = false
WHERE id IN ('receipts', 'quotes', 'whatsapp-media');

-- 2. Remover leitura pública do whatsapp-media
DROP POLICY IF EXISTS "WhatsApp media public read" ON storage.objects;

-- 3. receipts — políticas clinic-scoped (path: {clinic_id}/...)
DROP POLICY IF EXISTS "Receipts read clinic members" ON storage.objects;
DROP POLICY IF EXISTS "Receipts insert clinic members" ON storage.objects;
DROP POLICY IF EXISTS "Receipts update clinic members" ON storage.objects;
DROP POLICY IF EXISTS "Receipts delete clinic members" ON storage.objects;

CREATE POLICY "Receipts read clinic members"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Receipts insert clinic members"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Receipts update clinic members"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'receipts'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'receipts'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Receipts delete clinic members"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'receipts'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 4. quotes — políticas clinic-scoped (path: {clinic_id}/...)
DROP POLICY IF EXISTS "Quotes read clinic members" ON storage.objects;
DROP POLICY IF EXISTS "Quotes insert clinic members" ON storage.objects;
DROP POLICY IF EXISTS "Quotes update clinic members" ON storage.objects;
DROP POLICY IF EXISTS "Quotes delete clinic members" ON storage.objects;

CREATE POLICY "Quotes read clinic members"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'quotes'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Quotes insert clinic members"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'quotes'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Quotes update clinic members"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'quotes'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'quotes'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Quotes delete clinic members"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'quotes'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 5. whatsapp-media — leitura/remoção por membros da clínica (upload via service role)
DROP POLICY IF EXISTS "WhatsApp media service insert" ON storage.objects;
DROP POLICY IF EXISTS "WhatsApp media read clinic members" ON storage.objects;
DROP POLICY IF EXISTS "WhatsApp media delete clinic members" ON storage.objects;

CREATE POLICY "WhatsApp media read clinic members"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'whatsapp-media'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "WhatsApp media delete clinic members"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'whatsapp-media'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 6. Backfill: converter URLs públicas legadas em paths relativos
UPDATE public.receipts
SET pdf_url = regexp_replace(pdf_url, '^.*\/storage\/v1\/object\/public\/receipts\/', '')
WHERE pdf_url LIKE '%/storage/v1/object/public/receipts/%';

UPDATE public.whatsapp_messages
SET media_url = regexp_replace(media_url, '^.*\/storage\/v1\/object\/public\/whatsapp-media\/', '')
WHERE media_url LIKE '%/storage/v1/object/public/whatsapp-media/%';
