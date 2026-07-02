-- RLS least-privilege para dados clínicos sensíveis (consultation_notes, transcriptions).
-- Execute no SQL Editor do Supabase.

-- consultation_notes: médicos leem/escrevem próprias notas; admin e secretaria leem todas da clínica
DROP POLICY IF EXISTS "Consultation notes por clínica" ON public.consultation_notes;
DROP POLICY IF EXISTS "consultation_notes_clinic" ON public.consultation_notes;

CREATE POLICY "consultation_notes_select"
  ON public.consultation_notes
  FOR SELECT
  USING (
    clinic_id = public.get_my_clinic_id()
    AND (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'secretaria'))
      OR author_id = auth.uid()
    )
  );

CREATE POLICY "consultation_notes_insert_medico"
  ON public.consultation_notes
  FOR INSERT
  WITH CHECK (
    clinic_id = public.get_my_clinic_id()
    AND author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'medico')
  );

CREATE POLICY "consultation_notes_update_own"
  ON public.consultation_notes
  FOR UPDATE
  USING (clinic_id = public.get_my_clinic_id() AND author_id = auth.uid())
  WITH CHECK (clinic_id = public.get_my_clinic_id() AND author_id = auth.uid());

-- appointment_transcriptions: admin, secretaria, médico da consulta
DROP POLICY IF EXISTS "Transcriptions por clínica" ON public.appointment_transcriptions;

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

CREATE POLICY "appointment_transcriptions_write_staff"
  ON public.appointment_transcriptions
  FOR ALL
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
