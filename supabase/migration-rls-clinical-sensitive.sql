-- RLS least-privilege para dados clínicos sensíveis (consultation_notes, transcriptions).
-- Execute no SQL Editor do Supabase.
-- Requer: migration-consultation-notes.sql e migration-appointment-transcriptions.sql

-- ========== consultation_notes ==========
-- Coluna do médico autor: doctor_id (não author_id)

DROP POLICY IF EXISTS "Consultation notes por clínica" ON public.consultation_notes;
DROP POLICY IF EXISTS "consultation_notes_clinic" ON public.consultation_notes;
DROP POLICY IF EXISTS "Consultation notes read clinic" ON public.consultation_notes;
DROP POLICY IF EXISTS "Consultation notes insert doctor" ON public.consultation_notes;
DROP POLICY IF EXISTS "Consultation notes update doctor" ON public.consultation_notes;
DROP POLICY IF EXISTS "Consultation notes delete doctor" ON public.consultation_notes;
DROP POLICY IF EXISTS "consultation_notes_select" ON public.consultation_notes;
DROP POLICY IF EXISTS "consultation_notes_insert_medico" ON public.consultation_notes;
DROP POLICY IF EXISTS "consultation_notes_update_own" ON public.consultation_notes;
DROP POLICY IF EXISTS "consultation_notes_delete_own" ON public.consultation_notes;

-- Admin/secretaria: leem todas da clínica. Médico: só as próprias notas.
CREATE POLICY "consultation_notes_select"
  ON public.consultation_notes
  FOR SELECT
  USING (
    clinic_id = public.get_my_clinic_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'secretaria')
      )
      OR doctor_id = auth.uid()
    )
  );

CREATE POLICY "consultation_notes_insert_medico"
  ON public.consultation_notes
  FOR INSERT
  WITH CHECK (
    clinic_id = public.get_my_clinic_id()
    AND doctor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'medico'
    )
  );

CREATE POLICY "consultation_notes_update_own"
  ON public.consultation_notes
  FOR UPDATE
  USING (
    clinic_id = public.get_my_clinic_id()
    AND doctor_id = auth.uid()
  )
  WITH CHECK (
    clinic_id = public.get_my_clinic_id()
    AND doctor_id = auth.uid()
  );

CREATE POLICY "consultation_notes_delete_own"
  ON public.consultation_notes
  FOR DELETE
  USING (
    clinic_id = public.get_my_clinic_id()
    AND doctor_id = auth.uid()
  );

-- ========== appointment_transcriptions ==========

DROP POLICY IF EXISTS "Transcriptions por clínica" ON public.appointment_transcriptions;
DROP POLICY IF EXISTS "Appointment transcriptions read clinic" ON public.appointment_transcriptions;
DROP POLICY IF EXISTS "Appointment transcriptions insert staff" ON public.appointment_transcriptions;
DROP POLICY IF EXISTS "Appointment transcriptions update staff" ON public.appointment_transcriptions;
DROP POLICY IF EXISTS "appointment_transcriptions_select" ON public.appointment_transcriptions;
DROP POLICY IF EXISTS "appointment_transcriptions_insert_staff" ON public.appointment_transcriptions;
DROP POLICY IF EXISTS "appointment_transcriptions_update_staff" ON public.appointment_transcriptions;

CREATE POLICY "appointment_transcriptions_select"
  ON public.appointment_transcriptions
  FOR SELECT
  USING (
    clinic_id = public.get_my_clinic_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'secretaria', 'medico')
    )
  );

CREATE POLICY "appointment_transcriptions_insert_staff"
  ON public.appointment_transcriptions
  FOR INSERT
  WITH CHECK (
    clinic_id = public.get_my_clinic_id()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'secretaria', 'medico')
    )
  );

CREATE POLICY "appointment_transcriptions_update_staff"
  ON public.appointment_transcriptions
  FOR UPDATE
  USING (
    clinic_id = public.get_my_clinic_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'secretaria', 'medico')
    )
  )
  WITH CHECK (
    clinic_id = public.get_my_clinic_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'secretaria', 'medico')
    )
  );
