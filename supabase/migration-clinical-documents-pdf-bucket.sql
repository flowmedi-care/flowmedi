-- Storage bucket for clinical document PDFs

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clinical-documents',
  'clinical-documents',
  false,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY clinical_documents_storage_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'clinical-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT clinic_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY clinical_documents_storage_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'clinical-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT clinic_id::text FROM public.profiles WHERE id = auth.uid() AND role = 'medico'
    )
  );

CREATE POLICY clinical_documents_storage_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'clinical-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT clinic_id::text FROM public.profiles WHERE id = auth.uid() AND role = 'medico'
    )
  );
