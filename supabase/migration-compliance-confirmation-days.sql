-- Migration: Adicionar campo de compliance para confirmação de consultas
-- Execute no SQL Editor do Supabase

-- Adicionar coluna compliance_confirmation_days na tabela clinics
-- Este campo define quantos dias antes da consulta ela deve estar confirmada
-- Exemplo: se for 2, uma consulta agendada para dia 17 deve estar confirmada até dia 15
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS compliance_confirmation_days integer DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.clinics.compliance_confirmation_days IS 
  'Número de dias antes da consulta que ela deve estar confirmada. Exemplo: se for 2, uma consulta agendada para dia 17 deve estar confirmada até dia 15. NULL significa que a regra de compliance está desabilitada.';
