-- Fix: Corrigir problemas com exames não aparecendo
-- Execute este script no SQL Editor do Supabase

-- ========== DIAGNÓSTICO ==========

-- 1. Verificar exames sem clinic_id
SELECT 
  COUNT(*) as total_exames_sem_clinic_id,
  'Exames sem clinic_id' as tipo_problema
FROM public.patient_exams
WHERE clinic_id IS NULL;

-- 2. Verificar exames com clinic_id diferente do paciente
SELECT 
  COUNT(*) as total_exames_inconsistentes,
  'Exames com clinic_id inconsistente' as tipo_problema
FROM public.patient_exams pe
JOIN public.patients p ON p.id = pe.patient_id
WHERE pe.clinic_id != p.clinic_id;

-- 3. Verificar exames órfãos (paciente não existe mais)
SELECT 
  COUNT(*) as total_exames_orfaos,
  'Exames órfãos (paciente deletado)' as tipo_problema
FROM public.patient_exams pe
LEFT JOIN public.patients p ON p.id = pe.patient_id
WHERE p.id IS NULL;

-- ========== CORREÇÕES ==========

-- 4. Corrigir exames sem clinic_id usando o clinic_id do paciente
UPDATE public.patient_exams pe
SET clinic_id = p.clinic_id
FROM public.patients p
WHERE pe.patient_id = p.id
  AND pe.clinic_id IS NULL
  AND p.clinic_id IS NOT NULL;

-- 5. Corrigir exames com clinic_id inconsistente (usar clinic_id do paciente)
UPDATE public.patient_exams pe
SET clinic_id = p.clinic_id
FROM public.patients p
WHERE pe.patient_id = p.id
  AND pe.clinic_id != p.clinic_id
  AND p.clinic_id IS NOT NULL;

-- ========== MELHORAR POLÍTICA RLS ==========

-- 6. Recriar política RLS de leitura com verificação melhorada
DROP POLICY IF EXISTS "Patient exams read clinic" ON public.patient_exams;

CREATE POLICY "Patient exams read clinic"
  ON public.patient_exams
  FOR SELECT
  USING (
    -- Verificar se o clinic_id do exame corresponde ao clinic_id do usuário
    clinic_id IN (
      SELECT clinic_id 
      FROM public.profiles 
      WHERE id = auth.uid()
        AND clinic_id IS NOT NULL
    )
    -- Garantir que o exame tem clinic_id (não pode ser NULL)
    AND clinic_id IS NOT NULL
  );

-- ========== VERIFICAÇÃO FINAL ==========

-- 7. Verificar quantos exames foram corrigidos
SELECT 
  COUNT(*) as total_exames_corrigidos,
  'Exames corrigidos' as status
FROM public.patient_exams
WHERE clinic_id IS NOT NULL;

-- 8. Listar exames que ainda precisam de atenção (sem clinic_id e sem paciente)
SELECT 
  pe.id,
  pe.patient_id,
  pe.clinic_id,
  pe.file_name,
  pe.created_at,
  'Necessita atenção manual' as status
FROM public.patient_exams pe
LEFT JOIN public.patients p ON p.id = pe.patient_id
WHERE pe.clinic_id IS NULL
   OR p.id IS NULL;
