-- FlowMedi — Seed dos 4 planos principais
-- Execute APÓS migration-plans-pricing-display.sql
-- Você pode alterar tudo pelo admin em /admin/system/planos

-- Essencial
INSERT INTO public.plans (
  name, slug, description,
  max_doctors, max_secretaries, max_appointments_per_month,
  whatsapp_enabled, email_enabled, custom_logo_enabled, priority_support,
  price_display, features, sort_order, show_on_pricing, highlighted,
  cta_text, cta_href, is_active
)
SELECT
  'Essencial', 'essencial',
  'Para profissionais e clínicas de pequeno porte que precisam organizar agenda, comunicação e registros em um único sistema.',
  2, 2, 500,
  true, true, true, false,
  'R$89/mês',
  ARRAY[
    'Até 2 profissionais de saúde',
    'Até 2 secretárias',
    '500 consultas por mês',
    'Agenda completa com confirmações automáticas',
    'Registro de consultas com histórico por paciente',
    'Armazenamento de exames vinculado ao paciente',
    'Central de eventos e tarefas internas',
    'Templates personalizados de WhatsApp e e-mail',
    'Integração com 1 número oficial de WhatsApp Business (API oficial)',
    'Relatórios básicos',
    'Suporte padrão'
  ],
  10, true, false,
  'Assinar Essencial', '/dashboard/plano', true
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE slug = 'essencial');

-- Profissional
INSERT INTO public.plans (
  name, slug, description,
  max_doctors, max_secretaries, max_appointments_per_month,
  whatsapp_enabled, email_enabled, custom_logo_enabled, priority_support,
  price_display, features, sort_order, show_on_pricing, highlighted,
  cta_text, cta_href, is_active
)
SELECT
  'Profissional', 'profissional',
  'Para clínicas estruturadas que precisam de controle operacional e gestão da equipe.',
  6, 5, 2000,
  true, true, true, true,
  'R$347/mês',
  ARRAY[
    'Tudo do Essencial, além de:',
    'Até 6 profissionais de saúde',
    'Até 5 secretárias',
    '2.000 consultas por mês',
    'Relatórios avançados por profissional',
    'Controle de produtividade da equipe',
    'Indicadores operacionais',
    'Organização completa do histórico de atendimentos',
    'Suporte prioritário',
    'Integração WhatsApp Business API oficial'
  ],
  20, true, true,
  'Assinar Profissional', '/dashboard/plano', true
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE slug = 'profissional');

-- Estratégico
INSERT INTO public.plans (
  name, slug, description,
  max_doctors, max_secretaries, max_appointments_per_month,
  whatsapp_enabled, email_enabled, custom_logo_enabled, priority_support,
  price_display, features, sort_order, show_on_pricing, highlighted,
  cta_text, cta_href, is_active
)
SELECT
  'Estratégico', 'estrategico',
  'Para clínicas de médio porte que precisam de visão gerencial e controle total da operação.',
  12, 10, 5000,
  true, true, true, true,
  'R$697/mês',
  ARRAY[
    'Tudo do Profissional, além de:',
    'Até 12 profissionais de saúde',
    'Até 10 secretárias',
    '5.000 consultas por mês',
    'Relatórios gerenciais completos',
    'Métricas detalhadas por profissional e atendente',
    'Auditoria de ações e controle de equipe',
    'Indicadores de desempenho operacional',
    'Suporte prioritário avançado',
    'Mensagens oficiais WhatsApp cobradas diretamente pela Meta'
  ],
  30, true, false,
  'Assinar Estratégico', '/dashboard/plano', true
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE slug = 'estrategico');

-- Corporativo
INSERT INTO public.plans (
  name, slug, description,
  max_doctors, max_secretaries, max_appointments_per_month,
  whatsapp_enabled, email_enabled, custom_logo_enabled, priority_support,
  price_display, features, sort_order, show_on_pricing, highlighted,
  cta_text, cta_href, is_active
)
SELECT
  'Corporativo', 'corporativo',
  'Para clínicas maiores ou multiunidade.',
  NULL, NULL, NULL,
  true, true, true, true,
  'Sob consulta',
  ARRAY[
    '13+ profissionais',
    'Estrutura multiunidade',
    'Alto volume de consultas',
    'Configuração personalizada',
    'Onboarding assistido',
    'Suporte dedicado',
    'Integração oficial WhatsApp Business API'
  ],
  40, true, false,
  'Falar com vendas', '/criar-conta', true
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE slug = 'corporativo');
