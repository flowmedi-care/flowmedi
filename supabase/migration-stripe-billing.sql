-- FlowMedi — Stripe: campos para planos, clínicas e status de assinatura
-- Execute no SQL Editor do Supabase após criar Product + Price no Stripe Dashboard.

-- ========== PLANOS: ID do preço Stripe ==========
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

COMMENT ON COLUMN public.plans.stripe_price_id IS 'ID do Price na Stripe (ex: price_xxx). Preencher no plano Pro após criar em Stripe.';

-- ========== CLÍNICAS: Customer, Subscription e status ==========
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text
    CHECK (subscription_status IS NULL OR subscription_status IN ('active', 'past_due', 'canceled', 'unpaid'));

COMMENT ON COLUMN public.clinics.stripe_customer_id IS 'ID do Customer na Stripe. Criado na primeira assinatura.';
COMMENT ON COLUMN public.clinics.stripe_subscription_id IS 'ID da Subscription ativa na Stripe.';
COMMENT ON COLUMN public.clinics.subscription_status IS 'Status da assinatura: active (acesso Pro), past_due/unpaid/canceled (restringir).';

-- ========== Garantir planos Starter e Pro (se não existirem) ==========
INSERT INTO public.plans (name, slug, max_doctors, max_appointments_per_month, whatsapp_enabled)
SELECT 'Starter', 'starter', 1, 50, false
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE slug = 'starter');

INSERT INTO public.plans (name, slug, max_doctors, max_appointments_per_month, whatsapp_enabled)
SELECT 'Profissional', 'pro', null, null, true
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE slug = 'pro');

-- Depois de criar o preço no Stripe Dashboard, atualize o plano Pro manualmente:
-- UPDATE public.plans SET stripe_price_id = 'price_XXXXXXXX' WHERE slug = 'pro';
