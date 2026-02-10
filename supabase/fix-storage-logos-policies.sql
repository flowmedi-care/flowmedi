-- Configura políticas de Storage para o bucket 'logos'
-- Execute no Supabase: SQL Editor → New query → Cole → Run.
-- IMPORTANTE: Certifique-se de que o bucket 'logos' já foi criado manualmente no Dashboard

-- Remove políticas antigas se existirem
DROP POLICY IF EXISTS "Logo upload clinic admin" ON storage.objects;
DROP POLICY IF EXISTS "Logo update clinic admin" ON storage.objects;
DROP POLICY IF EXISTS "Logo upload doctor" ON storage.objects;
DROP POLICY IF EXISTS "Logo update doctor" ON storage.objects;
DROP POLICY IF EXISTS "Logo delete clinic admin" ON storage.objects;
DROP POLICY IF EXISTS "Logo delete doctor" ON storage.objects;
DROP POLICY IF EXISTS "Logo read public" ON storage.objects;

-- Política para admin fazer upload/update da logo da clínica
-- Os arquivos são salvos como: clinic-{clinic_id}.{ext}
CREATE POLICY "Logo upload clinic admin"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'logos' AND
    name LIKE 'clinic-%' AND
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'admin' AND COALESCE(active, true) = true
    )
  );

CREATE POLICY "Logo update clinic admin"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'logos' AND
    name LIKE 'clinic-%' AND
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'admin' AND COALESCE(active, true) = true
    )
  )
  WITH CHECK (
    bucket_id = 'logos' AND
    name LIKE 'clinic-%' AND
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'admin' AND COALESCE(active, true) = true
    )
  );

CREATE POLICY "Logo delete clinic admin"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'logos' AND
    name LIKE 'clinic-%' AND
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'admin' AND COALESCE(active, true) = true
    )
  );

-- Política para médico fazer upload/update da sua própria logo
-- Os arquivos são salvos como: doctor-{user_id}.{ext}
CREATE POLICY "Logo upload doctor"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'logos' AND
    name LIKE 'doctor-' || auth.uid()::text || '.%'
  );

CREATE POLICY "Logo update doctor"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'logos' AND
    name LIKE 'doctor-' || auth.uid()::text || '.%'
  )
  WITH CHECK (
    bucket_id = 'logos' AND
    name LIKE 'doctor-' || auth.uid()::text || '.%'
  );

CREATE POLICY "Logo delete doctor"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'logos' AND
    name LIKE 'doctor-' || auth.uid()::text || '.%'
  );

-- Política para leitura pública das logos (para exibir nos formulários)
CREATE POLICY "Logo read public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');
