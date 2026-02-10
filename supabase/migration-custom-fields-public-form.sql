-- Migration: Adicionar campo para incluir campos customizados em formulários públicos
-- Execute no SQL Editor do Supabase

-- Adicionar coluna para indicar se o campo deve aparecer no formulário público
ALTER TABLE public.patient_custom_fields
  ADD COLUMN IF NOT EXISTS include_in_public_form boolean NOT NULL DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN public.patient_custom_fields.include_in_public_form IS 'Se true, este campo aparecerá no formulário público antes dos campos do template';
