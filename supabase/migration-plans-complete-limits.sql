-- FlowMedi — Migration: Estrutura completa de limites dos planos
-- Execute no SQL Editor do Supabase
-- Esta migration expande a tabela plans com todos os limites e features

-- ========== EXPANDIR TABELA PLANS ==========
ALTER TABLE public.plans
  -- Limites numéricos
  ADD COLUMN IF NOT EXISTS max_secretaries int,
  ADD COLUMN IF NOT EXISTS max_patients int,
  ADD COLUMN IF NOT EXISTS max_form_templates int,
  ADD COLUMN IF NOT EXISTS max_custom_fields int,
  ADD COLUMN IF NOT EXISTS storage_mb int,
  
  -- Features booleanas
  ADD COLUMN IF NOT EXISTS email_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_logo_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority_support boolean DEFAULT false,
  
  -- Metadados
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Comentários para documentação
COMMENT ON COLUMN public.plans.max_doctors IS 'Limite de médicos (null = ilimitado)';
COMMENT ON COLUMN public.plans.max_secretaries IS 'Limite de secretários (null = ilimitado)';
COMMENT ON COLUMN public.plans.max_appointments_per_month IS 'Limite de consultas por mês (null = ilimitado)';
COMMENT ON COLUMN public.plans.max_patients IS 'Limite de pacientes (null = ilimitado)';
COMMENT ON COLUMN public.plans.max_form_templates IS 'Limite de templates de formulários (null = ilimitado)';
COMMENT ON COLUMN public.plans.max_custom_fields IS 'Limite de campos customizados (null = ilimitado)';
COMMENT ON COLUMN public.plans.storage_mb IS 'Armazenamento em MB para exames (null = ilimitado)';
COMMENT ON COLUMN public.plans.whatsapp_enabled IS 'WhatsApp transacional habilitado';
COMMENT ON COLUMN public.plans.email_enabled IS 'E-mail automático habilitado';
COMMENT ON COLUMN public.plans.custom_logo_enabled IS 'Logo personalizada habilitada';
COMMENT ON COLUMN public.plans.priority_support IS 'Suporte prioritário';
COMMENT ON COLUMN public.plans.description IS 'Descrição do plano';
COMMENT ON COLUMN public.plans.is_active IS 'Plano ativo (pode ser usado)';

-- ========== ATUALIZAR PLANO STARTER ==========
UPDATE public.plans
SET
  max_doctors = 1,
  max_secretaries = NULL, -- Ilimitado
  max_appointments_per_month = 30,
  max_patients = NULL, -- Ilimitado
  max_form_templates = 5,
  max_custom_fields = NULL, -- Ilimitado (não especificado, assumindo ilimitado)
  storage_mb = 500,
  whatsapp_enabled = false,
  email_enabled = false,
  custom_logo_enabled = false,
  priority_support = false,
  description = 'Plano gratuito para começar',
  is_active = true
WHERE slug = 'starter';

-- Se não existir, criar o plano Starter
INSERT INTO public.plans (
  name, slug, max_doctors, max_secretaries, max_appointments_per_month,
  max_patients, max_form_templates, max_custom_fields, storage_mb,
  whatsapp_enabled, email_enabled, custom_logo_enabled, priority_support,
  description, is_active
)
SELECT
  'Starter', 'starter', 1, NULL, 30,
  NULL, 5, NULL, 500,
  false, false, false, false,
  'Plano gratuito para começar', true
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE slug = 'starter');

-- ========== ATUALIZAR PLANO PRO ==========
UPDATE public.plans
SET
  max_doctors = NULL, -- Ilimitado
  max_secretaries = NULL, -- Ilimitado
  max_appointments_per_month = NULL, -- Ilimitado
  max_patients = NULL, -- Ilimitado
  max_form_templates = NULL, -- Ilimitado
  max_custom_fields = NULL, -- Ilimitado
  storage_mb = 10240, -- 10 GB = 10240 MB
  whatsapp_enabled = true,
  email_enabled = true,
  custom_logo_enabled = true,
  priority_support = true,
  description = 'Plano profissional com recursos ilimitados',
  is_active = true
WHERE slug = 'pro';

-- Se não existir, criar o plano Pro
INSERT INTO public.plans (
  name, slug, max_doctors, max_secretaries, max_appointments_per_month,
  max_patients, max_form_templates, max_custom_fields, storage_mb,
  whatsapp_enabled, email_enabled, custom_logo_enabled, priority_support,
  description, is_active
)
SELECT
  'Profissional', 'pro', NULL, NULL, NULL,
  NULL, NULL, NULL, 10240,
  true, true, true, true,
  'Plano profissional com recursos ilimitados', true
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE slug = 'pro');
