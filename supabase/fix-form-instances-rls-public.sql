-- Fix RLS para permitir formulários públicos
-- Execute no SQL Editor do Supabase

-- Remover política antiga que só permite com appointment_id
DROP POLICY IF EXISTS "Form instances por clínica" ON public.form_instances;

-- Nova política que permite:
-- 1. Instâncias vinculadas a consultas da clínica (appointment_id NOT NULL)
-- 2. Instâncias públicas vinculadas a templates da clínica (appointment_id IS NULL)
CREATE POLICY "Form instances por clínica" ON public.form_instances
  FOR ALL USING (
    -- Caso 1: Instância vinculada a consulta da clínica
    (
      appointment_id IS NOT NULL 
      AND appointment_id IN (
        SELECT id FROM public.appointments 
        WHERE clinic_id IN (
          SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
        )
      )
    )
    OR
    -- Caso 2: Instância pública vinculada a template da clínica
    (
      appointment_id IS NULL
      AND form_template_id IN (
        SELECT id FROM public.form_templates 
        WHERE clinic_id IN (
          SELECT clinic_id FROM public.profiles WHERE id = auth.uid()
        )
      )
    )
  );
