-- FlowMedi — Campos para exibição de planos na página de preços
-- Permite configurar na admin: preço exibido, features, CTA, destacado, etc.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS price_display text,
  ADD COLUMN IF NOT EXISTS features text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS show_on_pricing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS highlighted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cta_text text,
  ADD COLUMN IF NOT EXISTS cta_href text;

COMMENT ON COLUMN public.plans.price_display IS 'Texto exibido como preço (ex: R$89/mês, Sob consulta). Prioridade sobre Stripe quando definido.';
COMMENT ON COLUMN public.plans.features IS 'Lista de features exibidas na página de preços (bullet points).';
COMMENT ON COLUMN public.plans.sort_order IS 'Ordem de exibição na página de preços (menor = primeiro).';
COMMENT ON COLUMN public.plans.show_on_pricing IS 'Se true, o plano aparece na página /precos.';
COMMENT ON COLUMN public.plans.highlighted IS 'Se true, exibe badge "Popular" no card do plano.';
COMMENT ON COLUMN public.plans.cta_text IS 'Texto do botão de ação (ex: Assinar Essencial).';
COMMENT ON COLUMN public.plans.cta_href IS 'URL do botão (ex: /dashboard/plano, /criar-conta).';
