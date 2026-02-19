-- FlowMedi — Reset de dados Stripe de teste
-- Execute este script para limpar dados de assinaturas criadas no modo de teste
-- quando você mudou para produção

-- ========== OPÇÃO 1: Limpar TODOS os dados Stripe de teste ==========
-- (Recomendado quando migrar de teste para produção)
-- Isso limpa customer_id, subscription_id e volta todas as clínicas para Starter
UPDATE public.clinics
SET 
  stripe_customer_id = NULL,
  stripe_subscription_id = NULL,
  subscription_status = NULL,
  plan_id = (SELECT id FROM public.plans WHERE slug = 'starter' LIMIT 1)
WHERE stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL;

-- ========== OPÇÃO 2: Limpar apenas customer específico que está dando erro ==========
-- Descomente e substitua o customer_id:
-- UPDATE public.clinics
-- SET 
--   stripe_customer_id = NULL,
--   stripe_subscription_id = NULL,
--   subscription_status = NULL,
--   plan_id = (SELECT id FROM public.plans WHERE slug = 'starter' LIMIT 1)
-- WHERE stripe_customer_id = 'cus_TxLulLvm43fQ8j';

-- ========== OPÇÃO 3: Limpar apenas subscription específica ==========
-- UPDATE public.clinics
-- SET 
--   stripe_subscription_id = NULL,
--   subscription_status = NULL,
--   plan_id = (SELECT id FROM public.plans WHERE slug = 'starter' LIMIT 1)
-- WHERE stripe_subscription_id = 'sub_1SznDWQ3z0O2pdzC8r1OBPbh';

-- ========== OPÇÃO 4: Limpar UMA clínica específica ==========
-- Substitua 'SEU_CLINIC_ID_AQUI' pelo ID da sua clínica
-- Você pode encontrar o ID em /admin/system/clinicas
-- UPDATE public.clinics
-- SET 
--   stripe_customer_id = NULL,
--   stripe_subscription_id = NULL,
--   subscription_status = NULL,
--   plan_id = (SELECT id FROM public.plans WHERE slug = 'starter' LIMIT 1)
-- WHERE id = 'SEU_CLINIC_ID_AQUI';

-- ========== Verificar o resultado ==========
SELECT 
  id,
  name,
  stripe_customer_id,
  stripe_subscription_id,
  subscription_status,
  (SELECT slug FROM public.plans WHERE id = plan_id) as plan_slug
FROM public.clinics
ORDER BY created_at DESC;
