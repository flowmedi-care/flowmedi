-- Script para atualizar o plano Pro com o price_id de teste (R$ 3,00)
-- Substitua 'price_XXXXXXXX' pelo price_id real do produto de R$ 3,00 criado no Stripe

UPDATE public.plans 
SET stripe_price_id = 'price_XXXXXXXX' 
WHERE slug = 'pro';

-- Para verificar se atualizou corretamente:
SELECT id, name, slug, stripe_price_id 
FROM public.plans 
WHERE slug = 'pro';
