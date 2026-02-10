-- Migration: Tabela de exames dos pacientes
-- Execute no SQL Editor do Supabase

-- ========== TABELA PATIENT_EXAMS ==========
CREATE TABLE IF NOT EXISTS public.patient_exams (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  exam_type text,
  description text,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_by_role text CHECK (uploaded_by_role IN ('admin', 'secretaria', 'medico', 'patient')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_patient_exams_patient_id ON public.patient_exams(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_exams_appointment_id ON public.patient_exams(appointment_id);
CREATE INDEX IF NOT EXISTS idx_patient_exams_clinic_id ON public.patient_exams(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_exams_created_at ON public.patient_exams(created_at DESC);

-- ========== RLS (Row Level Security) ==========
ALTER TABLE public.patient_exams ENABLE ROW LEVEL SECURITY;

-- Membros da clínica podem ler exames de pacientes da mesma clínica
CREATE POLICY "Patient exams read clinic"
  ON public.patient_exams
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND COALESCE(active, true) = true
    )
  );

-- Secretária e admin podem inserir exames
CREATE POLICY "Patient exams insert secretaria admin"
  ON public.patient_exams
  FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'secretaria')
      AND COALESCE(active, true) = true
    )
  );

-- Secretária e admin podem atualizar exames
CREATE POLICY "Patient exams update secretaria admin"
  ON public.patient_exams
  FOR UPDATE
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'secretaria')
      AND COALESCE(active, true) = true
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'secretaria')
      AND COALESCE(active, true) = true
    )
  );

-- Secretária e admin podem deletar exames
CREATE POLICY "Patient exams delete secretaria admin"
  ON public.patient_exams
  FOR DELETE
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'secretaria')
      AND COALESCE(active, true) = true
    )
  );
