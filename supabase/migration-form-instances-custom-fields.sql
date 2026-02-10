-- Migration: Adicionar campo para armazenar campos customizados de formulários públicos
-- Execute no SQL Editor do Supabase

-- Adicionar coluna para armazenar campos customizados do submissor público
ALTER TABLE public.form_instances
  ADD COLUMN IF NOT EXISTS public_submitter_custom_fields jsonb DEFAULT '{}';

-- Comentário explicativo
COMMENT ON COLUMN public.form_instances.public_submitter_custom_fields IS 'Campos customizados preenchidos no formulário público (serão transferidos para custom_fields do paciente ao cadastrar)';
