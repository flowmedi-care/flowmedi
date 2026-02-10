-- Migration: Formulários públicos
-- Execute no SQL Editor do Supabase

-- ========== ADICIONAR is_public EM form_templates ==========
ALTER TABLE public.form_templates
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- ========== MODIFICAR form_instances PARA SUPORTAR FORMULÁRIOS PÚBLICOS ==========
-- Tornar appointment_id opcional (NULL para formulários públicos)
ALTER TABLE public.form_instances
  ALTER COLUMN appointment_id DROP NOT NULL;

-- Adicionar campos para dados básicos do não-cadastrado
ALTER TABLE public.form_instances
  ADD COLUMN IF NOT EXISTS public_submitter_name text,
  ADD COLUMN IF NOT EXISTS public_submitter_email text,
  ADD COLUMN IF NOT EXISTS public_submitter_phone text,
  ADD COLUMN IF NOT EXISTS public_submitter_birth_date date;

-- Adicionar public_link_token para links públicos
ALTER TABLE public.form_instances
  ADD COLUMN IF NOT EXISTS public_link_token text UNIQUE;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_form_instances_public_link_token ON public.form_instances(public_link_token);
CREATE INDEX IF NOT EXISTS idx_form_instances_public_email ON public.form_instances(public_submitter_email);
CREATE INDEX IF NOT EXISTS idx_form_instances_public_phone ON public.form_instances(public_submitter_phone);
CREATE INDEX IF NOT EXISTS idx_form_instances_appointment_null ON public.form_instances(appointment_id) WHERE appointment_id IS NULL;

-- Adicionar constraint: se appointment_id é NULL, deve ter public_link_token
-- (vamos fazer via trigger ou lógica da aplicação, pois CHECK não funciona bem com NULL)

-- Comentário explicativo
COMMENT ON COLUMN public.form_templates.is_public IS 'Se true, permite criar instâncias públicas (sem appointment_id)';
COMMENT ON COLUMN public.form_instances.appointment_id IS 'NULL para formulários públicos, preenchido para formulários vinculados a consultas';
COMMENT ON COLUMN public.form_instances.public_link_token IS 'Token único para links públicos (quando appointment_id é NULL)';
COMMENT ON COLUMN public.form_instances.public_submitter_name IS 'Nome de quem preencheu formulário público';
COMMENT ON COLUMN public.form_instances.public_submitter_email IS 'Email de quem preencheu formulário público';
COMMENT ON COLUMN public.form_instances.public_submitter_phone IS 'Telefone de quem preencheu formulário público';
COMMENT ON COLUMN public.form_instances.public_submitter_birth_date IS 'Data de nascimento de quem preencheu formulário público';
