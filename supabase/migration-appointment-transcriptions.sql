-- Migration: Transcrições de áudio vinculadas ao atendimento
-- Execute no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.appointment_transcriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  external_job_id text,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  transcript text,
  error_message text,
  duration_seconds numeric,
  processing_time_seconds numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_appointment_transcriptions_appointment
  ON public.appointment_transcriptions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_transcriptions_clinic
  ON public.appointment_transcriptions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointment_transcriptions_external_job
  ON public.appointment_transcriptions(external_job_id);
CREATE INDEX IF NOT EXISTS idx_appointment_transcriptions_created_at
  ON public.appointment_transcriptions(created_at DESC);

ALTER TABLE public.appointment_transcriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Appointment transcriptions read clinic" ON public.appointment_transcriptions;
DROP POLICY IF EXISTS "Appointment transcriptions insert staff" ON public.appointment_transcriptions;
DROP POLICY IF EXISTS "Appointment transcriptions update staff" ON public.appointment_transcriptions;

CREATE POLICY "Appointment transcriptions read clinic"
  ON public.appointment_transcriptions
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Appointment transcriptions insert staff"
  ON public.appointment_transcriptions
  FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('medico', 'admin', 'secretaria')
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Appointment transcriptions update staff"
  ON public.appointment_transcriptions
  FOR UPDATE
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('medico', 'admin', 'secretaria')
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('medico', 'admin', 'secretaria')
    )
  );
