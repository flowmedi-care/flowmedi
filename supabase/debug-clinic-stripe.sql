-- Debug: verificar clínicas, perfis e Stripe
-- Execute no SQL Editor do Supabase. Rode cada bloco separadamente ou tudo de uma vez.

-- ========== 1) CLÍNICAS + PLANO ==========
-- (colunas stripe_*: rode migration-stripe-billing.sql se não existirem)
SELECT
  c.id as clinic_id,
  c.name as clinic_name,
  c.plan_id,
  p.name as plan_name,
  p.slug as plan_slug,
  c.created_at
FROM public.clinics c
LEFT JOIN public.plans p ON p.id = c.plan_id
ORDER BY c.created_at;

-- ========== 2) PERFIS (admins) + CLÍNICA ==========
-- Verifica se cada admin tem clínica válida
SELECT
  pr.id as profile_id,
  pr.email,
  pr.full_name,
  pr.role,
  pr.clinic_id,
  pr.active,
  c.name as clinic_name,
  CASE WHEN c.id IS NULL THEN 'ERRO: clínica não existe' ELSE 'OK' END as status
FROM public.profiles pr
LEFT JOIN public.clinics c ON c.id = pr.clinic_id
WHERE pr.role = 'admin'
ORDER BY pr.created_at;

-- ========== 3) PLANOS ==========
SELECT id, name, slug
FROM public.plans
ORDER BY slug;

-- ========== 4) PROBLEMAS: clinic_id órfão ==========
-- Perfis cujo clinic_id não existe em clinics (dados inconsistentes)
SELECT pr.id, pr.email, pr.clinic_id, 'clinic_id não existe em clinics' as problema
FROM public.profiles pr
WHERE pr.clinic_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = pr.clinic_id);

-- ========== 5) COLUNAS DE clinics ==========
-- Se faltar stripe_*, rode migration-stripe-billing.sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'clinics'
ORDER BY ordinal_position;
