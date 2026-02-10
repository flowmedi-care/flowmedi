-- Migration: Tabela de posts/notas da consulta (tipo Facebook)
-- Execute no SQL Editor do Supabase

-- ========== TABELA CONSULTATION_NOTES ==========
CREATE TABLE IF NOT EXISTS public.consultation_notes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_consultation_notes_appointment_id ON public.consultation_notes(appointment_id);
CREATE INDEX IF NOT EXISTS idx_consultation_notes_doctor_id ON public.consultation_notes(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultation_notes_clinic_id ON public.consultation_notes(clinic_id);
CREATE INDEX IF NOT EXISTS idx_consultation_notes_created_at ON public.consultation_notes(created_at DESC);

-- ========== RLS (Row Level Security) ==========
ALTER TABLE public.consultation_notes ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas se existirem
DROP POLICY IF EXISTS "Consultation notes read clinic" ON public.consultation_notes;
DROP POLICY IF EXISTS "Consultation notes insert doctor" ON public.consultation_notes;
DROP POLICY IF EXISTS "Consultation notes update doctor" ON public.consultation_notes;
DROP POLICY IF EXISTS "Consultation notes delete doctor" ON public.consultation_notes;

-- Membros da clínica podem ler posts de consultas da mesma clínica
CREATE POLICY "Consultation notes read clinic"
  ON public.consultation_notes
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- Médicos podem inserir posts em consultas da mesma clínica
CREATE POLICY "Consultation notes insert doctor"
  ON public.consultation_notes
  FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'medico'
    )
    AND doctor_id = auth.uid()
  );

-- Médicos podem atualizar seus próprios posts
CREATE POLICY "Consultation notes update doctor"
  ON public.consultation_notes
  FOR UPDATE
  USING (
    doctor_id = auth.uid()
    AND clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'medico'
    )
  )
  WITH CHECK (
    doctor_id = auth.uid()
    AND clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'medico'
    )
  );

-- Médicos podem deletar seus próprios posts
CREATE POLICY "Consultation notes delete doctor"
  ON public.consultation_notes
  FOR DELETE
  USING (
    doctor_id = auth.uid()
    AND clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'medico'
    )
  );
