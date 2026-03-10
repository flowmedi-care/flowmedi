-- Fase 2: Entitlements de relatórios por plano
-- Objetivo: alinhar copy comercial com permissões reais de backend/UI.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS reports_basic_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reports_advanced_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reports_managerial_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS productivity_team_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS operational_indicators_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS audit_log_enabled boolean DEFAULT false;

COMMENT ON COLUMN public.plans.reports_basic_enabled IS 'Relatórios básicos (visão geral).';
COMMENT ON COLUMN public.plans.reports_advanced_enabled IS 'Relatórios avançados por profissional/atendente.';
COMMENT ON COLUMN public.plans.reports_managerial_enabled IS 'Relatórios gerenciais completos (inclui financeiro).';
COMMENT ON COLUMN public.plans.productivity_team_enabled IS 'Indicadores de produtividade de equipe.';
COMMENT ON COLUMN public.plans.operational_indicators_enabled IS 'Indicadores operacionais detalhados.';
COMMENT ON COLUMN public.plans.audit_log_enabled IS 'Acesso ao módulo de auditoria da clínica.';

-- Baseline por plano comercial atual.
UPDATE public.plans
SET
  reports_basic_enabled = true,
  reports_advanced_enabled = false,
  reports_managerial_enabled = false,
  productivity_team_enabled = false,
  operational_indicators_enabled = false,
  audit_log_enabled = false
WHERE slug = 'essencial';

UPDATE public.plans
SET
  reports_basic_enabled = true,
  reports_advanced_enabled = true,
  reports_managerial_enabled = false,
  productivity_team_enabled = true,
  operational_indicators_enabled = true,
  audit_log_enabled = false
WHERE slug = 'profissional';

UPDATE public.plans
SET
  reports_basic_enabled = true,
  reports_advanced_enabled = true,
  reports_managerial_enabled = true,
  productivity_team_enabled = true,
  operational_indicators_enabled = true,
  audit_log_enabled = true
WHERE slug = 'estrategico';

UPDATE public.plans
SET
  reports_basic_enabled = true,
  reports_advanced_enabled = true,
  reports_managerial_enabled = true,
  productivity_team_enabled = true,
  operational_indicators_enabled = true,
  audit_log_enabled = true
WHERE slug = 'corporativo';
