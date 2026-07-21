-- Storage policies for public product-images bucket
-- Path convention: {clinic_id}/{uuid}.{ext}

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Product images public read" ON storage.objects;
DROP POLICY IF EXISTS "Product images insert clinic admin" ON storage.objects;
DROP POLICY IF EXISTS "Product images update clinic admin" ON storage.objects;
DROP POLICY IF EXISTS "Product images delete clinic admin" ON storage.objects;

CREATE POLICY "Product images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Product images insert clinic admin"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] IN (
      SELECT clinic_id::text FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'secretaria')
    )
  );

CREATE POLICY "Product images update clinic admin"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] IN (
      SELECT clinic_id::text FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'secretaria')
    )
  );

CREATE POLICY "Product images delete clinic admin"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] IN (
      SELECT clinic_id::text FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'secretaria')
    )
  );
