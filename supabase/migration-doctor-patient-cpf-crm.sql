-- Migration: CPF/CRM do médico e CPF do paciente (documentos clínicos)
-- Execute no SQL Editor do Supabase

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS crm text,
  ADD COLUMN IF NOT EXISTS crm_uf char(2),
  ADD COLUMN IF NOT EXISTS specialty text;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS cpf text;

COMMENT ON COLUMN public.profiles.cpf IS 'CPF do profissional (apenas dígitos recomendado); necessário para assinatura ICP';
COMMENT ON COLUMN public.profiles.crm IS 'CRM do médico';
COMMENT ON COLUMN public.profiles.crm_uf IS 'UF do CRM (2 letras)';
COMMENT ON COLUMN public.patients.cpf IS 'CPF do paciente para receitas e pedidos de exame';
