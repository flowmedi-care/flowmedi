-- Fix: Corrigir exames sem clinic_id
-- Execute este script no SQL Editor do Supabase para corrigir exames que foram inseridos sem clinic_id

-- 1. Verificar exames sem clinic_id
SELECT 
  pe.id,
  pe.patient_id,
  pe.clinic_id,
  p.clinic_id as patient_clinic_id,
  pe.file_name,
  pe.created_at
FROM public.patient_exams pe
LEFT JOIN public.patients p ON p.id = pe.patient_id
WHERE pe.clinic_id IS NULL;

-- 2. Atualizar exames sem clinic_id usando o clinic_id do paciente
UPDATE public.patient_exams pe
SET clinic_id = p.clinic_id
FROM public.patients p
WHERE pe.patient_id = p.id
  AND pe.clinic_id IS NULL
  AND p.clinic_id IS NOT NULL;

-- 3. Verificar se ainda há exames sem clinic_id (devem ser deletados ou corrigidos manualmente)
SELECT 
  pe.id,
  pe.patient_id,
  pe.clinic_id,
  pe.file_name,
  pe.created_at
FROM public.patient_exams pe
WHERE pe.clinic_id IS NULL;

-- 4. Verificar se há exames com clinic_id diferente do paciente (inconsistência)
SELECT 
  pe.id,
  pe.patient_id,
  pe.clinic_id as exam_clinic_id,
  p.clinic_id as patient_clinic_id,
  pe.file_name
FROM public.patient_exams pe
JOIN public.patients p ON p.id = pe.patient_id
WHERE pe.clinic_id != p.clinic_id;

-- 5. Corrigir exames com clinic_id inconsistente (usar clinic_id do paciente)
UPDATE public.patient_exams pe
SET clinic_id = p.clinic_id
FROM public.patients p
WHERE pe.patient_id = p.id
  AND pe.clinic_id != p.clinic_id
  AND p.clinic_id IS NOT NULL;
