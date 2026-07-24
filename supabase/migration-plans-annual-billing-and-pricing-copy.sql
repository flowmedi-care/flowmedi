-- FlowMed — Billing anual + copy de pricing (promessa / IA progressiva)
-- Execute no Supabase SQL editor após migrations de plans existentes.

-- 1) Colunas de preço anual / dual Stripe Price
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS stripe_price_id_monthly text,
  ADD COLUMN IF NOT EXISTS stripe_price_id_annually text,
  ADD COLUMN IF NOT EXISTS price_display_annual text;

COMMENT ON COLUMN public.plans.stripe_price_id_monthly IS 'Stripe Price ID (recorrência mensal). Preferir sobre stripe_price_id legado.';
COMMENT ON COLUMN public.plans.stripe_price_id_annually IS 'Stripe Price ID (recorrência anual).';
COMMENT ON COLUMN public.plans.price_display_annual IS 'Texto de preço anual na /precos (ex: R$71/mês).';

-- Backfill: monthly = legado stripe_price_id
UPDATE public.plans
SET stripe_price_id_monthly = stripe_price_id
WHERE stripe_price_id IS NOT NULL
  AND (stripe_price_id_monthly IS NULL OR stripe_price_id_monthly = '');

-- 2) Atualizar nomes + copy (slugs permanecem)
-- Essencial
UPDATE public.plans SET
  name = 'Essencial',
  description = 'Organize agenda, comunicação e registros com IA básica para começar com leveza.',
  price_display = 'R$89/mês',
  price_display_annual = 'R$71/mês',
  features = ARRAY[
    'Agenda inteligente e prontuário',
    'WhatsApp integrado',
    'Financeiro da clínica',
    'IA básica (respostas rápidas e sugestões, com limite mensal)',
    'Até 2 profissionais'
  ],
  cta_text = 'Assinar Essencial',
  highlighted = false
WHERE slug = 'essencial';

-- Crescimento (slug profissional)
UPDATE public.plans SET
  name = 'Crescimento',
  description = 'Automatize atendimento e operação com IA de atendimento — o diferencial para clínicas em crescimento.',
  price_display = 'R$347/mês',
  price_display_annual = 'R$278/mês',
  features = ARRAY[
    'Tudo do Essencial',
    'CRM de pacientes',
    'IA de atendimento e automações',
    'Dashboards e gestão da equipe',
    'Até 6 profissionais'
  ],
  cta_text = 'Assinar Crescimento',
  highlighted = true
WHERE slug = 'profissional';

-- Operação (slug estrategico)
UPDATE public.plans SET
  name = 'Operação',
  description = 'Controle completo com IA operacional avançada, auditoria e visão gerencial.',
  price_display = 'R$697/mês',
  price_display_annual = 'R$558/mês',
  features = ARRAY[
    'Tudo do Crescimento',
    'IA operacional avançada (recomendações, insights, maior volume)',
    'Auditoria de ações',
    'Multi-equipe e API',
    'Até 12 profissionais'
  ],
  cta_text = 'Assinar Operação',
  highlighted = false
WHERE slug = 'estrategico';

-- Corporativo
UPDATE public.plans SET
  name = 'Corporativo',
  description = 'Multiunidade, alto volume e configuração personalizada com IA no ritmo da sua operação.',
  price_display = 'Sob consulta',
  price_display_annual = NULL,
  features = ARRAY[
    '13+ profissionais',
    'Estrutura multiunidade',
    'Onboarding assistido',
    'Suporte dedicado',
    'IA no volume da operação'
  ],
  cta_text = 'Falar com vendas',
  highlighted = false
WHERE slug = 'corporativo';
