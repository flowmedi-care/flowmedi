-- Permite upload da imagem do hero no bucket logos (site público)
-- Execute se ainda usar caminhos site-hero-* ou após atualizar o app.
-- O app atual salva como: clinic-{clinic_id}-hero.{ext} (já coberto por clinic-%)

DROP POLICY IF EXISTS "Site hero upload clinic admin" ON storage.objects;
DROP POLICY IF EXISTS "Site hero update clinic admin" ON storage.objects;
DROP POLICY IF EXISTS "Site hero delete clinic admin" ON storage.objects;

CREATE POLICY "Site hero upload clinic admin"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'logos' AND
    (name LIKE 'clinic-%' OR name LIKE 'site-hero-%') AND
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'admin' AND COALESCE(active, true) = true
    )
  );

CREATE POLICY "Site hero update clinic admin"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'logos' AND
    (name LIKE 'clinic-%' OR name LIKE 'site-hero-%') AND
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'admin' AND COALESCE(active, true) = true
    )
  )
  WITH CHECK (
    bucket_id = 'logos' AND
    (name LIKE 'clinic-%' OR name LIKE 'site-hero-%') AND
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'admin' AND COALESCE(active, true) = true
    )
  );

CREATE POLICY "Site hero delete clinic admin"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'logos' AND
    (name LIKE 'clinic-%' OR name LIKE 'site-hero-%') AND
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'admin' AND COALESCE(active, true) = true
    )
  );
