-- Migration: Storage bucket e políticas para exames
-- Execute no SQL Editor do Supabase
-- IMPORTANTE: Crie o bucket 'exams' manualmente no Dashboard primeiro:
-- Storage → Create bucket → Nome: 'exams' → Public: false → File size limit: 20MB
-- Allowed MIME types: application/pdf, image/jpeg, image/png, image/webp, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document

-- Remove políticas antigas se existirem
DROP POLICY IF EXISTS "Exams upload secretaria admin" ON storage.objects;
DROP POLICY IF EXISTS "Exams update secretaria admin" ON storage.objects;
DROP POLICY IF EXISTS "Exams delete secretaria admin" ON storage.objects;
DROP POLICY IF EXISTS "Exams read clinic members" ON storage.objects;

-- Política para secretária e admin fazer upload de exames
-- Os arquivos são salvos como: {clinic_id}/{patient_id}/{exam_id}.{ext}
CREATE POLICY "Exams upload secretaria admin"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'exams' AND
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role IN ('admin', 'secretaria')
    )
  );

-- Política para secretária e admin atualizar exames
CREATE POLICY "Exams update secretaria admin"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'exams' AND
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role IN ('admin', 'secretaria')
    )
  )
  WITH CHECK (
    bucket_id = 'exams' AND
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role IN ('admin', 'secretaria')
    )
  );

-- Política para secretária e admin deletar exames
CREATE POLICY "Exams delete secretaria admin"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'exams' AND
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role IN ('admin', 'secretaria')
    )
  );

-- Política para membros da clínica lerem exames
-- Verifica se o arquivo pertence a um paciente da mesma clínica do usuário
CREATE POLICY "Exams read clinic members"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'exams' AND
    EXISTS (
      SELECT 1 FROM public.patient_exams pe
      INNER JOIN public.profiles p ON p.clinic_id = pe.clinic_id
      WHERE pe.file_url LIKE '%' || storage.objects.name || '%'
      AND p.id = auth.uid()
    )
  );
