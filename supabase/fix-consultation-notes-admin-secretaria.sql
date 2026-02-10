-- Admin e secretaria podem criar, editar e deletar posts no registro da consulta
-- Execute no SQL Editor do Supabase

DROP POLICY IF EXISTS "Consultation notes insert doctor" ON public.consultation_notes;
DROP POLICY IF EXISTS "Consultation notes update doctor" ON public.consultation_notes;
DROP POLICY IF EXISTS "Consultation notes delete doctor" ON public.consultation_notes;

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

-- Admin e secretaria podem inserir posts (doctor_id = seu id como autor)
CREATE POLICY "Consultation notes insert admin secretaria"
  ON public.consultation_notes
  FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'secretaria')
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

-- Admin e secretaria podem atualizar qualquer post da clínica
CREATE POLICY "Consultation notes update admin secretaria"
  ON public.consultation_notes
  FOR UPDATE
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'secretaria')
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'secretaria')
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

-- Admin e secretaria podem deletar qualquer post da clínica
CREATE POLICY "Consultation notes delete admin secretaria"
  ON public.consultation_notes
  FOR DELETE
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'secretaria')
    )
  );
