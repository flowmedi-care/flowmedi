-- Bucket patient-photos privado com RLS por clínica.
-- Execute no SQL Editor do Supabase.

INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-photos', 'patient-photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

UPDATE storage.buckets SET public = false WHERE id = 'patient-photos';

DROP POLICY IF EXISTS "Patient photos read clinic" ON storage.objects;
DROP POLICY IF EXISTS "Patient photos insert clinic" ON storage.objects;
DROP POLICY IF EXISTS "Patient photos update clinic" ON storage.objects;
DROP POLICY IF EXISTS "Patient photos delete clinic" ON storage.objects;

CREATE POLICY "Patient photos read clinic"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'patient-photos'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Patient photos insert clinic"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'patient-photos'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Patient photos update clinic"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'patient-photos'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Patient photos delete clinic"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'patient-photos'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
    )
  );
