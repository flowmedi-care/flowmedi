-- Migration: Adicionar campo para associar médico a formulário público
-- Execute no SQL Editor do Supabase

-- Adicionar campo para médico associado ao formulário público no template
ALTER TABLE public.form_templates
  ADD COLUMN IF NOT EXISTS public_doctor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.form_templates.public_doctor_id IS 'Médico associado ao formulário público (para exibir assinatura)';
