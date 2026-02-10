-- Script de diagnóstico para exames de pacientes
-- Execute no SQL Editor do Supabase para verificar se há problemas

-- 1. Verificar se há exames na tabela
SELECT 
  id,
  patient_id,
  appointment_id,
  clinic_id,
  file_name,
  created_at,
  uploaded_by,
  uploaded_by_role
FROM public.patient_exams
ORDER BY created_at DESC
LIMIT 10;

-- 2. Verificar se o clinic_id está sendo preenchido corretamente
SELECT 
  COUNT(*) as total_exames,
  COUNT(clinic_id) as exames_com_clinic_id,
  COUNT(*) - COUNT(clinic_id) as exames_sem_clinic_id
FROM public.patient_exams;

-- 3. Verificar políticas RLS ativas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'patient_exams';

-- 4. Verificar se há exames sem clinic_id (problema comum)
SELECT 
  id,
  patient_id,
  clinic_id,
  file_name,
  created_at
FROM public.patient_exams
WHERE clinic_id IS NULL;

-- 5. Verificar exames de um paciente específico (substitua o UUID)
-- SELECT 
--   pe.*,
--   p.clinic_id as patient_clinic_id,
--   pr.clinic_id as profile_clinic_id
-- FROM public.patient_exams pe
-- LEFT JOIN public.patients p ON p.id = pe.patient_id
-- LEFT JOIN public.profiles pr ON pr.id = pe.uploaded_by
-- WHERE pe.patient_id = 'SUBSTITUA_PELO_UUID_DO_PACIENTE';
